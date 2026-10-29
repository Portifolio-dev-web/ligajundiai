import { randomBytes, randomInt, createHash } from 'node:crypto'
import { Router } from 'express'
import { authenticator } from 'otplib'
import { z } from 'zod'
import { config } from '../config.js'
import { query, transaction } from '../db/pool.js'
import { AppError, unauthorized } from '../errors.js'
import { createSession, authenticate, authenticateIfPresent, authorize, hashPassword, requireTotp, revokeSession, verifyUserPassword, verifyUnknownUserPassword } from '../security/auth.js'
import { rgDigest, encryptSensitive, decryptSensitive, safeEqual } from '../security/crypto.js'
import { emailSchema, parse, requireValidRg, cleanText } from '../security/validation.js'
import { enqueueEmail, escapeHtml } from '../services/email.js'
import { enqueueSms } from '../services/sms.js'
import { asyncRoute, audit } from '../utils.js'
import {
  authRateLimit, loginAccountRateLimit, otpRequestAccountRateLimit,
  forgotPasswordRequestRateLimit, forgotPasswordVerifyRateLimit,
} from '../security/rate-limit.js'

export const authRouter = Router()
// SEGURANÇA (achado do usuário, 2026-10-23): authRateLimit antes valia para o roteador inteiro,
// inclusive GET /me — chamada a cada navegação dentro do painel (middleware.js checa a sessão a
// cada página protegida) e pelo front ao carregar. Isso consumia o orçamento de 10 req/15min só de
// navegar, e a tentativa de login seguinte (mesmo sendo a única "tentativa" de verdade) já caía
// bloqueada. Agora o limitador só vale nas rotas que são tentativas de autenticação de fato
// (registro, login, pedido/confirmação de código) — /me, /logout, /reconsent e /totp/rotate/* exigem
// sessão já autenticada e não são o alvo deste limite.

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(12).max(128),
  phone: z.string().trim().max(30).optional().default(''),
  rg: z.string().optional().default(''),
  consent: z.literal(true),
  consent_version: z.string().trim().max(40).optional(),
}).strict()

authRouter.post('/register', authRateLimit, asyncRoute(async (req, res) => {
  const input = parse(registerSchema, req.body)
  const rg = input.rg ? requireValidRg(input.rg) : null
  const user = await transaction(async (client) => {
    const created = await client.query(
      `INSERT INTO users
       (role, name, email, password_hash, phone, rg_ciphertext, rg_hash, consent_at, consent_version, consent_confirmed)
       VALUES ('gestor', $1, $2, $3, $4, $5, $6, now(), $7, true)
       RETURNING id, role, name, email, phone, created_at`,
      [
        cleanText(input.name, 120),
        input.email,
        await hashPassword(input.password),
        cleanText(input.phone, 30),
        rg ? encryptSensitive(rg) : null,
        rg ? rgDigest(rg) : null,
        input.consent_version || config.CONSENT_VERSION,
      ],
    )
    const createdUser = created.rows[0]
    await audit(client, createdUser, 'user.register', 'user', createdUser.id, { role: 'gestor' })
    // LGPD (risco 4, análise LVJ 2027): consent_at/consent_version na própria linha de "users" não
    // são uma trilha — um novo consentimento (ou a anonimização em privacy.js) sobrescreve os dois.
    // Este registro em audit_logs é separado, nunca é apagado pela anonimização, e por isso é a prova
    // de que o consentimento foi dado, mesmo depois que o titular peça a exclusão da conta.
    // LGPD (varredura, item L5): ip do pedido — ver backend/src/services/legalTexts.js para o
    // porquê de guardar hash do texto (nos fluxos que têm um texto específico), não o texto inteiro.
    await audit(client, createdUser, 'consent.recorded', 'user', createdUser.id, {
      consent_version: input.consent_version || config.CONSENT_VERSION,
      role: 'gestor',
      ip: req.ip,
    })
    return createdUser
  })
  await createSession(user, res)
  res.status(201).json({ user })
}))

authRouter.post('/login-password', authRateLimit, loginAccountRateLimit, asyncRoute(async (req, res) => {
  const input = parse(z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    totp: z.string().trim().regex(/^\d{6}$/).optional(),
  }).strict(), req.body)
  const result = await query(
    `SELECT id, role, name, email, password_hash, legacy_password_salt,
       legacy_password_hash, totp_secret_ciphertext, consent_version
     FROM users WHERE lower(email) = $1 AND deleted_at IS NULL AND status = 'active'`,
    [input.email],
  )
  const user = result.rows[0]
  // SEGURANÇA (varredura, item S13): mesmo custo de CPU nos dois ramos — ver verifyUnknownUserPassword.
  const passwordValid = user ? await verifyUserPassword(user, input.password) : await verifyUnknownUserPassword(input.password)
  if (!user || !passwordValid) {
    throw unauthorized('E-mail ou senha inválidos')
  }
  if (user.role === 'admin') {
    requireTotp(input.totp)
    const secret = decryptSensitive(user.totp_secret_ciphertext)
    if (!secret || !authenticator.check(input.totp, secret)) {
      throw unauthorized('Código de autenticação de dois fatores inválido')
    }
  }
  if (user.legacy_password_salt) {
    await query(
      'UPDATE users SET password_hash = $2, legacy_password_salt = NULL, legacy_password_hash = NULL, updated_at = now() WHERE id = $1',
      [user.id, await hashPassword(input.password)],
    )
  }
  await createSession(user, res)
  // LGPD (varredura, item L10): ver GET /auth/me para o porquê de consent_outdated.
  res.json({ user: { id: user.id, role: user.role, name: user.name, email: user.email, consent_outdated: user.consent_version !== config.CONSENT_VERSION } })
}))

authRouter.post('/otp/request', authRateLimit, otpRequestAccountRateLimit, asyncRoute(async (req, res) => {
  const input = parse(z.object({ email: emailSchema }).strict(), req.body)
  const result = await query(
    `SELECT id, email, name FROM users
     WHERE lower(email) = $1 AND status = 'active' AND deleted_at IS NULL`,
    [input.email],
  )
  const user = result.rows[0]
  if (user) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const codeHash = createHash('sha256').update(`${user.id}:${code}`).digest('hex')
    const expiry = new Date(Date.now() + 10 * 60 * 1000)
    await transaction(async (client) => {
      await client.query(
        'INSERT INTO otp_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, codeHash, expiry],
      )
      const eventId = `otp:${user.id}:${randomBytes(16).toString('hex')}`
      await enqueueEmail(client, {
        to: user.email,
        subject: 'Seu código de acesso - Liga de Voleibol Jundiaí',
        html: `<p>Seu código de acesso é <strong>${escapeHtml(code)}</strong>.</p><p>Ele expira em 10 minutos.</p>`,
        // SEGURANÇA (varredura, item S1): o painel do admin (GET /admin/emails) não pode mostrar
        // um código capaz de autenticar outra pessoa. Só quem recebe o e-mail de verdade vê o código.
        adminPreviewHtml: '<p>Código de acesso enviado. Por segurança, o código não é exibido neste painel.</p>',
        eventId,
      })
    })
  }
  res.json({ ok: true, message: 'Se a conta existir, um código será enviado por e-mail.' })
}))

authRouter.post('/otp/verify', authRateLimit, asyncRoute(async (req, res) => {
  const input = parse(z.object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{6}$/),
  }).strict(), req.body)
  const codeHashPrefix = input.email
  const result = await query(
    `SELECT o.id AS otp_id, o.user_id, o.code_hash, u.id, u.role, u.name, u.email, u.consent_version
     FROM otp_codes o JOIN users u ON u.id = o.user_id
     WHERE lower(u.email) = $1 AND o.purpose = 'login' AND o.consumed_at IS NULL AND o.expires_at > now()
       AND o.attempts < 5 AND u.status = 'active' AND u.deleted_at IS NULL
     ORDER BY o.created_at DESC LIMIT 1`,
    [codeHashPrefix],
  )
  const row = result.rows[0]
  if (!row) throw unauthorized('Código inválido ou expirado')
  const submitted = createHash('sha256').update(`${row.user_id}:${input.code}`).digest('hex')
  if (!safeEqual(submitted, row.code_hash)) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.otp_id])
    throw unauthorized('Código inválido ou expirado')
  }
  const consumed = await query(
    'UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING id',
    [row.otp_id],
  )
  if (!consumed.rowCount) throw unauthorized('Código inválido ou expirado')
  if (row.role === 'admin') throw new AppError(401, 'TOTP_REQUIRED', 'Administradores devem entrar com senha e código TOTP')
  await createSession(row, res)
  res.json({ user: { id: row.id, role: row.role, name: row.name, email: row.email, consent_outdated: row.consent_version !== config.CONSENT_VERSION } })
}))

// ESQUECI MINHA SENHA: três passos — request (identifica a conta e dispara a verificação),
// verify (confirma TOTP de admin ou código SMS de atleta/gestor e troca a prova por um token de
// uso único) e reset (só o token decide, nunca o código em si — mesmo motivo de
// totp_pending_secret_ciphertext: a prova de posse e a ação final são passos separados).
const forgotPasswordRequestSchema = z.object({ email: emailSchema }).strict()

const forgotPasswordVerifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/).optional(),
  totp: z.string().trim().regex(/^\d{6}$/).optional(),
}).strict()

const forgotPasswordResetSchema = z.object({
  reset_token: z.string().trim().min(32).max(256),
  password: z.string().min(12).max(128),
}).strict()

authRouter.post('/forgot-password/request', authRateLimit, forgotPasswordRequestRateLimit, asyncRoute(async (req, res) => {
  const input = parse(forgotPasswordRequestSchema, req.body)
  const result = await query(
    `SELECT id, name, email, role, phone FROM users
     WHERE lower(email) = $1 AND status = 'active' AND deleted_at IS NULL`,
    [input.email],
  )
  const user = result.rows[0]
  // SEGURANÇA: e-mail desconhecido e conta de atleta/gestor respondem exatamente igual (mesma
  // mensagem, mesmo "method": "sms") — só uma conta de administrador revela "totp", porque é
  // disso que a tela seguinte precisa para pedir o código certo. Nunca confirma se o e-mail existe.
  if (user?.role === 'admin') {
    return res.json({ ok: true, method: 'totp' })
  }
  if (user?.phone) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const codeHash = createHash('sha256').update(`${user.id}:${code}`).digest('hex')
    const expiry = new Date(Date.now() + 10 * 60 * 1000)
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO otp_codes (user_id, code_hash, expires_at, purpose)
         VALUES ($1, $2, $3, 'password_reset_sms')`,
        [user.id, codeHash, expiry],
      )
      const eventId = `pwreset-sms:${user.id}:${randomBytes(16).toString('hex')}`
      await enqueueSms(client, {
        to: user.phone,
        body: `LVJ: seu código de recuperação de senha é ${code}. Ele expira em 10 minutos.`,
        adminPreviewBody: 'Código de recuperação de senha enviado por SMS. Por segurança, o código não é exibido aqui.',
        eventId,
      })
      await audit(client, user, 'password_reset.sms_requested', 'user', user.id, { ip: req.ip })
    })
  }
  res.json({ ok: true, method: 'sms' })
}))

authRouter.post('/forgot-password/verify', authRateLimit, forgotPasswordVerifyRateLimit, asyncRoute(async (req, res) => {
  const input = parse(forgotPasswordVerifySchema, req.body)
  const result = await query(
    `SELECT id, role, name, email, totp_secret_ciphertext FROM users
     WHERE lower(email) = $1 AND status = 'active' AND deleted_at IS NULL`,
    [input.email],
  )
  const user = result.rows[0]
  if (!user) throw unauthorized('Código inválido ou expirado')

  if (user.role === 'admin') {
    requireTotp(input.totp)
    const secret = decryptSensitive(user.totp_secret_ciphertext)
    if (!secret || !authenticator.check(input.totp, secret)) {
      throw unauthorized('Código de autenticação de dois fatores inválido')
    }
  } else {
    if (!input.code) throw unauthorized('Código inválido ou expirado')
    const otpResult = await query(
      `SELECT id, code_hash FROM otp_codes
       WHERE user_id = $1 AND purpose = 'password_reset_sms' AND consumed_at IS NULL
         AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    )
    const otp = otpResult.rows[0]
    if (!otp) throw unauthorized('Código inválido ou expirado')
    const submitted = createHash('sha256').update(`${user.id}:${input.code}`).digest('hex')
    if (!safeEqual(submitted, otp.code_hash)) {
      await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id])
      throw unauthorized('Código inválido ou expirado')
    }
    const consumed = await query(
      'UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING id',
      [otp.id],
    )
    if (!consumed.rowCount) throw unauthorized('Código inválido ou expirado')
  }

  const resetToken = randomBytes(32).toString('hex')
  const resetTokenHash = createHash('sha256').update(resetToken).digest('hex')
  const expiry = new Date(Date.now() + 10 * 60 * 1000)
  await transaction(async (client) => {
    await client.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetTokenHash, expiry],
    )
    await audit(client, user, 'password_reset.verified', 'user', user.id, {
      ip: req.ip,
      method: user.role === 'admin' ? 'totp' : 'sms',
    })
  })
  // SEGURANÇA: mesmo padrão de /totp/rotate/start — este token só aparece aqui, direto para quem
  // acabou de provar a identidade, e nunca de novo depois disso.
  res.json({ ok: true, reset_token: resetToken, expires_at: expiry })
}))

authRouter.post('/forgot-password/reset', authRateLimit, asyncRoute(async (req, res) => {
  const input = parse(forgotPasswordResetSchema, req.body)
  const tokenHash = createHash('sha256').update(input.reset_token).digest('hex')
  const result = await query(
    `SELECT prt.id AS token_id, u.id, u.role, u.name, u.email
     FROM password_reset_tokens prt JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.consumed_at IS NULL AND prt.expires_at > now()
       AND u.status = 'active' AND u.deleted_at IS NULL`,
    [tokenHash],
  )
  const row = result.rows[0]
  if (!row) throw new AppError(401, 'RESET_TOKEN_INVALID', 'Token de redefinição inválido ou expirado')

  await transaction(async (client) => {
    const consumed = await client.query(
      'UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id',
      [row.token_id],
    )
    if (!consumed.rowCount) throw new AppError(401, 'RESET_TOKEN_INVALID', 'Token de redefinição inválido ou expirado')
    await client.query(
      `UPDATE users SET password_hash = $2, legacy_password_salt = NULL, legacy_password_hash = NULL,
         updated_at = now() WHERE id = $1`,
      [row.id, await hashPassword(input.password)],
    )
    // SEGURANÇA: redefinir a senha revoga toda sessão ativa da conta — inclusive uma sessão que um
    // invasor tenha aberto antes do titular recuperar o acesso.
    await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.id])
    await audit(client, row, 'password_reset.completed', 'user', row.id, { ip: req.ip })
  })
  res.json({ ok: true })
}))

authRouter.get('/me', authenticateIfPresent, asyncRoute(async (req, res) => {
  if (!req.user) return res.json({ user: null, teams: [] })
  let teams = []
  if (req.user.role === 'gestor') {
    // Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe, então a
    // sessão devolve a lista inteira, não mais "a equipe" no singular.
    const result = await query(
      `SELECT t.*, u.name AS manager_name, u.email AS manager_email
       FROM teams t JOIN users u ON u.id = t.manager_user_id
       WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at`,
      [req.user.id],
    )
    teams = result.rows
  }
  // LGPD (varredura, item L10): consent_version era gravado no cadastro mas nunca comparado com a
  // versão atual em lugar nenhum — quem consentiu com uma versão antiga continuava com acesso total
  // para sempre, mesmo que a Política/Termos mudassem de forma relevante depois (a própria política,
  // seção 11, dizia "fique atento à versão", sem nenhum bloqueio real por trás disso). O front usa
  // esta flag para pedir um reconsentimento explícito (POST /auth/reconsent) antes de continuar.
  const { consent_version, ...publicUser } = req.user
  res.json({ user: { ...publicUser, consent_outdated: consent_version !== config.CONSENT_VERSION }, teams })
}))

// LGPD (varredura, item L10): registra o reconsentimento com a versão atual — mesmo padrão de
// trilha separada e imutável do cadastro original (auth.js, athletes.js, teams.js): audit_logs
// prova quando cada pessoa aceitou cada versão, mesmo depois de reconsentimentos futuros
// sobrescreverem consent_at/consent_version na própria linha de "users".
authRouter.post('/reconsent', authenticate, asyncRoute(async (req, res) => {
  await transaction(async (client) => {
    await client.query(
      'UPDATE users SET consent_at = now(), consent_version = $2, updated_at = now() WHERE id = $1',
      [req.user.id, config.CONSENT_VERSION],
    )
    await audit(client, req.user, 'consent.recorded', 'user', req.user.id, {
      consent_version: config.CONSENT_VERSION,
      role: req.user.role,
      ip: req.ip,
      reason: 'reconsent_outdated_version',
    })
  })
  res.json({ ok: true })
}))

authRouter.post('/logout', authenticate, asyncRoute(async (req, res) => {
  await revokeSession(req, res)
  res.json({ ok: true })
}))

// SEGURANÇA (varredura, item S21): antes o segredo TOTP do admin só vinha de ADMIN_TOTP_SECRET,
// regravado no banco a cada boot — sem fluxo de troca pelo próprio admin. As três rotas abaixo
// implementam o padrão de verdade (como o checklist pede): gera um segredo novo, exige o código
// ATUAL antes de começar (prova que quem pede ainda controla o autenticador de hoje) e só promove o
// segredo novo a ativo depois de confirmar um código gerado a partir DELE (prova de posse do
// aparelho novo) — nunca fica "pendente" sem confirmação para sempre (expira em 10 minutos).
const totpAccountName = (email) => email
const totpIssuer = 'Liga de Voleibol Jundiaí (LVJ)'
const TOTP_PENDING_TTL_MS = 10 * 60 * 1000

authRouter.post('/totp/rotate/start', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const input = parse(z.object({ current_totp: z.string().trim().regex(/^\d{6}$/) }).strict(), req.body)
  const result = await query('SELECT totp_secret_ciphertext FROM users WHERE id = $1', [req.user.id])
  const currentSecret = decryptSensitive(result.rows[0]?.totp_secret_ciphertext)
  if (!currentSecret || !authenticator.check(input.current_totp, currentSecret)) {
    throw unauthorized('Código de autenticação de dois fatores atual inválido')
  }
  const newSecret = authenticator.generateSecret()
  await query(
    'UPDATE users SET totp_pending_secret_ciphertext = $2, totp_pending_expires_at = $3, updated_at = now() WHERE id = $1',
    [req.user.id, encryptSensitive(newSecret), new Date(Date.now() + TOTP_PENDING_TTL_MS)],
  )
  // SEGURANÇA: a única vez que este segredo aparece em texto puro é nesta resposta, direto para
  // quem acabou de provar (com o código atual) que é o próprio admin — nunca em log, nunca de novo
  // depois disso (o GET de status só diz se há segredo pendente, não qual é).
  res.json({
    secret: newSecret,
    otpauth_url: authenticator.keyuri(totpAccountName(req.user.email), totpIssuer, newSecret),
    expires_at: new Date(Date.now() + TOTP_PENDING_TTL_MS),
  })
}))

authRouter.post('/totp/rotate/confirm', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const input = parse(z.object({ new_totp: z.string().trim().regex(/^\d{6}$/) }).strict(), req.body)
  const result = await query(
    'SELECT totp_pending_secret_ciphertext, totp_pending_expires_at FROM users WHERE id = $1',
    [req.user.id],
  )
  const row = result.rows[0]
  if (!row?.totp_pending_secret_ciphertext || !row.totp_pending_expires_at || row.totp_pending_expires_at < new Date()) {
    throw new AppError(400, 'TOTP_ROTATION_NOT_STARTED', 'Nenhuma troca de 2FA pendente ou ela expirou — comece de novo')
  }
  const pendingSecret = decryptSensitive(row.totp_pending_secret_ciphertext)
  if (!authenticator.check(input.new_totp, pendingSecret)) {
    throw unauthorized('Código inválido para o novo segredo — confira o app autenticador')
  }
  await transaction(async (client) => {
    await client.query(
      `UPDATE users SET totp_secret_ciphertext = $2, totp_pending_secret_ciphertext = NULL,
         totp_pending_expires_at = NULL, updated_at = now() WHERE id = $1`,
      [req.user.id, encryptSensitive(pendingSecret)],
    )
    await audit(client, req.user, 'admin.totp_rotated', 'user', req.user.id, { ip: req.ip })
  })
  res.json({ ok: true })
}))

authRouter.post('/totp/rotate/cancel', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  await query(
    'UPDATE users SET totp_pending_secret_ciphertext = NULL, totp_pending_expires_at = NULL, updated_at = now() WHERE id = $1',
    [req.user.id],
  )
  res.json({ ok: true })
}))
