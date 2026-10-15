import { randomBytes, randomInt, createHash } from 'node:crypto'
import { Router } from 'express'
import argon2 from 'argon2'
import { authenticator } from 'otplib'
import { z } from 'zod'
import { config } from '../config.js'
import { query, transaction } from '../db/pool.js'
import { AppError, unauthorized } from '../errors.js'
import { createSession, authenticate, hashPassword, requireTotp, revokeSession, verifyUserPassword } from '../security/auth.js'
import { cpfDigest, encryptSensitive, decryptSensitive, safeEqual } from '../security/crypto.js'
import { emailSchema, parse, requireValidCpf, cleanText } from '../security/validation.js'
import { enqueueEmail, escapeHtml } from '../services/email.js'
import { asyncRoute, audit } from '../utils.js'
import { authRateLimit } from '../security/rate-limit.js'

export const authRouter = Router()
authRouter.use(authRateLimit)

const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: z.string().min(12).max(128),
  phone: z.string().trim().max(30).optional().default(''),
  consent: z.literal(true),
  consent_version: z.string().trim().max(40).optional(),
}).strict()

const registerManagerSchema = accountSchema.extend({
  cpf: z.string().optional().default(''),
}).strict()

async function createAccount(input, role, res) {
  const cpf = input.cpf ? requireValidCpf(input.cpf) : null
  const user = await transaction(async (client) => {
    const created = await client.query(
      `INSERT INTO users
       (role, name, email, password_hash, phone, cpf_ciphertext, cpf_hash, consent_at, consent_version, consent_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, true)
       RETURNING id, role, name, email, phone, created_at`,
      [
        role,
        cleanText(input.name, 120),
        input.email,
        await hashPassword(input.password),
        cleanText(input.phone, 30),
        cpf ? encryptSensitive(cpf) : null,
        cpf ? cpfDigest(cpf) : null,
        input.consent_version || config.CONSENT_VERSION,
      ],
    )
    const createdUser = created.rows[0]
    await audit(client, createdUser, 'user.register', 'user', createdUser.id, { role })
    return createdUser
  })
  await createSession(user, res)
  return user
}

authRouter.post('/register', asyncRoute(async (req, res) => {
  const input = parse(registerManagerSchema, req.body)
  const user = await createAccount(input, 'gestor', res)
  res.status(201).json({ user })
}))

authRouter.post('/register-athlete', asyncRoute(async (req, res) => {
  const input = parse(accountSchema, req.body)
  const user = await createAccount(input, 'atleta', res)
  res.status(201).json({ user })
}))

authRouter.post('/login-password', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    totp: z.string().trim().regex(/^\d{6}$/).optional(),
  }).strict(), req.body)
  const result = await query(
    `SELECT id, role, name, email, password_hash, legacy_password_salt,
       legacy_password_hash, totp_secret_ciphertext
     FROM users WHERE lower(email) = $1 AND deleted_at IS NULL AND status = 'active'`,
    [input.email],
  )
  const user = result.rows[0]
  if (!user || !(await verifyUserPassword(user, input.password))) {
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
  res.json({ user: { id: user.id, role: user.role, name: user.name, email: user.email } })
}))

authRouter.post('/otp/request', asyncRoute(async (req, res) => {
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
        eventId,
      })
    })
  }
  res.json({ ok: true, message: 'Se a conta existir, um código será enviado por e-mail.' })
}))

authRouter.post('/otp/verify', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{6}$/),
  }).strict(), req.body)
  const codeHashPrefix = input.email
  const result = await query(
    `SELECT o.id AS otp_id, o.user_id, o.code_hash, u.id, u.role, u.name, u.email
     FROM otp_codes o JOIN users u ON u.id = o.user_id
     WHERE lower(u.email) = $1 AND o.consumed_at IS NULL AND o.expires_at > now()
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
  res.json({ user: { id: row.id, role: row.role, name: row.name, email: row.email } })
}))

authRouter.get('/me', authenticate, asyncRoute(async (req, res) => {
  let team = null
  if (req.user.role === 'gestor') {
    const result = await query(
      `SELECT t.*, u.name AS manager_name, u.email AS manager_email
       FROM teams t JOIN users u ON u.id = t.manager_user_id
       WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL LIMIT 1`,
      [req.user.id],
    )
    team = result.rows[0] ?? null
  }
  res.json({ user: req.user, team })
}))

authRouter.post('/logout', authenticate, asyncRoute(async (req, res) => {
  await revokeSession(req, res)
  res.json({ ok: true })
}))
