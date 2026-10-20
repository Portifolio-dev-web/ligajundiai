import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize, createSession, hashPassword } from '../security/auth.js'
import { cpfDigest, encryptSensitive, maskCpf } from '../security/crypto.js'
import { cleanText, emailSchema, parse, requireValidCpf, validatePositions, uuidSchema } from '../security/validation.js'
import { enqueueEmail, escapeHtml } from '../services/email.js'
import { createBiometryUpload } from '../services/storage.js'
import { assertRegistrationOpen } from '../services/registration.js'
import { asyncRoute, audit, notify, toPublicAthlete, userTeam } from '../utils.js'
import { authRateLimit } from '../security/rate-limit.js'

export const athletesRouter = Router()
export const adminAthletesRouter = Router()
export const gestorAthletesRouter = Router()

const positionSchema = z.array(z.enum(['central', 'ponteiro', 'saida', 'levantador', 'libero']))
function positionsFrom(input) {
  const positions = input.positions ?? (input.position ? [input.position] : [])
  return validatePositions(positions)
}

// LGPD (varredura, item L2): abaixo de 18 anos o consentimento precisa ser do responsável legal
// (art. 14 da LGPD), não do próprio atleta. 18 é o corte adotado aqui (maioridade civil no Brasil).
const MINOR_AGE_LIMIT = 18

async function createAthlete(client, { userId, managerId, team, input, actor }) {
  await assertRegistrationOpen(team.category, 'athlete', client)
  if (!input.consent) throw new AppError(400, 'CONSENT_REQUIRED', 'É necessário registrar o consentimento explícito')
  const cpf = requireValidCpf(input.cpf)
  const positions = positionsFrom(input)
  const key = input.biometry_key || null
  if (key && !key.startsWith(`biometry/${managerId}/`)) {
    throw new AppError(400, 'INVALID_BIOMETRY_KEY', 'A chave de biometria não pertence a esta equipe')
  }
  const existing = await client.query(
    `SELECT id FROM athletes WHERE cpf_hash = $1 AND team_id = $2 AND deleted_at IS NULL`,
    [cpfDigest(cpf), team.id],
  )
  if (existing.rowCount) throw new AppError(409, 'ATHLETE_ALREADY_EXISTS', 'Este CPF já está cadastrado nesta equipe')
  const date = input.birthdate ? new Date(`${input.birthdate}T00:00:00Z`) : null
  if (date && Number.isNaN(date.getTime())) throw new AppError(400, 'INVALID_BIRTHDATE', 'Data de nascimento inválida')
  const calculatedAge = date ? Math.floor((Date.now() - date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)) : null
  const age = calculatedAge ?? input.age ?? null
  if (age !== null && (age < 0 || age > 120)) throw new AppError(400, 'INVALID_BIRTHDATE', 'Data de nascimento inválida')
  if (calculatedAge !== null && input.age !== undefined && calculatedAge !== input.age) {
    throw new AppError(400, 'AGE_MISMATCH', 'A idade informada não corresponde à data de nascimento')
  }

  // LGPD (varredura, item L2): atleta menor de idade precisa do responsável legal identificado —
  // nome, CPF e parentesco — e não só de alguém marcar uma caixinha de "confirmo que obtive o
  // consentimento". Sem essa identificação, não há como provar quem consentiu (art. 8º, ônus da
  // prova é do controlador) nem como a liga responder se o responsável pedir a exclusão dos dados.
  const isMinor = age !== null && age < MINOR_AGE_LIMIT
  let guardianCpf = null
  if (isMinor) {
    if (!input.guardian_name || !input.guardian_cpf || !input.guardian_relationship) {
      throw new AppError(400, 'GUARDIAN_REQUIRED', 'Para atletas menores de 18 anos, informe nome, CPF e parentesco do responsável legal')
    }
    guardianCpf = requireValidCpf(input.guardian_cpf)
  }

  const result = await client.query(
    `INSERT INTO athletes
     (user_id, team_id, manager_user_id, name, cpf_ciphertext, cpf_hash, birthdate,
       age_at_registration, positions, status, consent_at, consent_version, contact_email,
       consent_confirmed, biometry_object_key, biometry_url,
       guardian_name, guardian_cpf_ciphertext, guardian_relationship)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'awaiting_manager', now(), $10, $11, true, $12, $13, $14, $15, $16)
     RETURNING id, user_id, team_id, manager_user_id, name, birthdate,
       age_at_registration, positions, status, justification, biometry_url,
       biometry_status, control_id_reference, created_at,
       guardian_name, guardian_cpf_ciphertext, guardian_relationship`,
    [
      userId,
      team.id,
      managerId,
      cleanText(input.name, 120),
      encryptSensitive(cpf),
      cpfDigest(cpf),
      date,
      age,
      positions,
      input.consent_version || config.CONSENT_VERSION,
      input.email || null,
      key,
      key ? `s3://${config.S3_BUCKET}/${key}` : null,
      isMinor ? cleanText(input.guardian_name, 120) : null,
      isMinor ? encryptSensitive(guardianCpf) : null,
      isMinor ? cleanText(input.guardian_relationship, 60) : null,
    ],
  )
  const athlete = result.rows[0]
  await client.query(
    `INSERT INTO athlete_positions (athlete_id, position)
     SELECT $1, unnest($2::text[])`,
    [athlete.id, positions],
  )
  await notify(client, 'admin', 'athlete_pending_manager', 'Novo atleta aguardando análise', `${athlete.name} aguarda a aprovação do gestor.`)
  await notify(client, managerId, 'athlete_pending_manager', 'Novo atleta aguardando análise', `${athlete.name} aguarda a aprovação da equipe.`)
  await audit(client, actor, 'athlete.register', 'athlete', athlete.id, { team_id: team.id })
  return athlete
}

athletesRouter.post('/biometry-upload', authenticate, authorize('gestor'), asyncRoute(async (req, res) => {
  const input = parse(z.object({ content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']) }).strict(), req.body)
  const team = await userTeam(req.user.id)
  if (!team || team.status !== 'approved') {
    throw new AppError(403, 'TEAM_NOT_APPROVED', 'A equipe precisa ser aprovada antes do cadastro de atletas')
  }
  await assertRegistrationOpen(team.category, 'athlete')
  const upload = await createBiometryUpload(req.user.id, input.content_type)
  if (!upload) throw new AppError(400, 'INVALID_CONTENT_TYPE', 'Formato de imagem não suportado')
  res.status(201).json(upload)
}))

athletesRouter.post('/biometry-upload-public', authRateLimit, asyncRoute(async (req, res) => {
  const input = parse(z.object({
    team_id: uuidSchema,
    content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }).strict(), req.body)
  const selected = await query(
    `SELECT manager_user_id, category FROM teams
     WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL`,
    [input.team_id],
  )
  const team = selected.rows[0]
  if (!team) throw new AppError(400, 'TEAM_NOT_AVAILABLE', 'Selecione uma equipe aprovada')
  await assertRegistrationOpen(team.category, 'athlete')
  const upload = await createBiometryUpload(team.manager_user_id, input.content_type)
  if (!upload) throw new AppError(400, 'INVALID_CONTENT_TYPE', 'Formato de imagem não suportado')
  res.status(201).json(upload)
}))

athletesRouter.post('/', authenticate, authorize('gestor'), asyncRoute(async (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(2).max(120),
    cpf: z.string().min(1).max(20),
    birthdate: z.string().date().optional(),
    age: z.number().int().min(0).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    position: z.enum(['central', 'ponteiro', 'saida', 'levantador', 'libero']).optional(),
    positions: positionSchema.optional(),
    biometry_key: z.string().max(300).optional(),
    consent: z.literal(true),
    consent_version: z.string().max(40).optional(),
    // LGPD (varredura, item L2): só exigidos pelo createAthlete quando a idade informada for < 18.
    guardian_name: z.string().trim().min(2).max(120).optional(),
    guardian_cpf: z.string().min(1).max(20).optional(),
    guardian_relationship: z.string().trim().min(2).max(60).optional(),
  }).strict(), req.body)
  const team = await userTeam(req.user.id)
  if (!team) throw new AppError(400, 'TEAM_REQUIRED', 'Cadastre sua equipe primeiro')
  if (team.status !== 'approved') throw new AppError(403, 'TEAM_NOT_APPROVED', 'A equipe precisa ser aprovada antes do cadastro de atletas')
  const athlete = await transaction((client) => createAthlete(client, {
    userId: null, managerId: req.user.id, team, input, actor: req.user,
  }))
  // LGPD (varredura, item L2): troquei o spread manual por toPublicAthlete — createAthlete agora
  // devolve também guardian_cpf_ciphertext, que não pode ir para a resposta sem ser mascarado.
  res.status(201).json({ athlete: { ...toPublicAthlete(athlete), position: athlete.positions[0] } })
}))

athletesRouter.post('/self-register', authRateLimit, asyncRoute(async (req, res) => {
  const input = parse(z.object({
    team_id: uuidSchema,
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: z.string().min(12).max(128),
    cpf: z.string().min(1).max(20),
    birthdate: z.string().date().optional(),
    age: z.number().int().min(0).max(120).optional(),
    positions: positionSchema,
    biometry_key: z.string().min(1).max(300),
    consent: z.literal(true),
    consent_version: z.string().trim().max(40).optional(),
    // LGPD (varredura, item L2): o próprio atleta pode ser menor de idade (categorias Sub-19); se a
    // idade informada for < 18, createAthlete exige esses três campos antes de gravar o cadastro.
    guardian_name: z.string().trim().min(2).max(120).optional(),
    guardian_cpf: z.string().min(1).max(20).optional(),
    guardian_relationship: z.string().trim().min(2).max(60).optional(),
  }).strict(), req.body)
  const selected = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.id = $1 AND t.status = 'approved' AND t.deleted_at IS NULL`,
    [input.team_id],
  )
  const team = selected.rows[0]
  if (!team) throw new AppError(400, 'TEAM_NOT_AVAILABLE', 'Selecione uma equipe aprovada')
  await assertRegistrationOpen(team.category, 'athlete')
  const keyPrefix = `biometry/${team.manager_user_id}/`
  if (!input.biometry_key.startsWith(keyPrefix)) {
    throw new AppError(400, 'INVALID_BIOMETRY_KEY', 'A chave da foto não pertence à equipe selecionada')
  }
  const cpf = requireValidCpf(input.cpf)
  const passwordHash = await hashPassword(input.password)
  const result = await transaction(async (client) => {
    const createdUser = await client.query(
      `INSERT INTO users
       (role, name, email, password_hash, cpf_ciphertext, cpf_hash,
        consent_at, consent_version, consent_confirmed)
       VALUES ('atleta', $1, $2, $3, $4, $5, now(), $6, true)
       RETURNING id, role, name, email`,
      [
        cleanText(input.name, 120),
        input.email,
        passwordHash,
        encryptSensitive(cpf),
        cpfDigest(cpf),
        input.consent_version || config.CONSENT_VERSION,
      ],
    )
    const user = createdUser.rows[0]
    await assertRegistrationOpen(team.category, 'athlete', client)
    const athlete = await createAthlete(client, {
      userId: user.id,
      managerId: team.manager_user_id,
      team,
      input,
      actor: user,
    })
    return { user, athlete }
  })
  await createSession(result.user, res)
  res.status(201).json({ user: result.user, athlete: toPublicAthlete(result.athlete) })
}))

athletesRouter.get('/mine', authenticate, authorize('gestor'), asyncRoute(async (req, res) => {
  const team = await userTeam(req.user.id)
  if (!team) return res.json({ athletes: [] })
  const result = await query(
    // LGPD (varredura, item L2): guardian_name/guardian_cpf_ciphertext/guardian_relationship
    // entram aqui para o gestor conseguir ver, nos próprios atletas da equipe, quem é o
    // responsável legal registrado (toPublicAthlete mascara o CPF do responsável, igual ao do atleta).
    `SELECT a.id, a.user_id, a.team_id, a.manager_user_id, a.name, a.birthdate,
       a.age_at_registration, a.positions, a.status, a.justification, a.biometry_url,
       a.biometry_status, a.control_id_reference, a.created_at, a.cpf_ciphertext,
       a.guardian_name, a.guardian_cpf_ciphertext, a.guardian_relationship
     FROM athletes a WHERE a.team_id = $1 AND a.deleted_at IS NULL ORDER BY a.created_at DESC`,
    [team.id],
  )
  res.json({ athletes: result.rows.map((athlete) => ({ ...toPublicAthlete(athlete), position: athlete.positions[0] })) })
}))

athletesRouter.get('/me', authenticate, authorize('atleta'), asyncRoute(async (req, res) => {
  const result = await query(
    `SELECT a.id, a.team_id, a.name, a.birthdate, a.positions, a.status, a.justification,
      a.biometry_status, a.control_id_reference, a.created_at
     FROM athletes a WHERE a.user_id = $1 AND a.deleted_at IS NULL ORDER BY a.created_at DESC`,
    [req.user.id],
  )
  res.json({ athletes: result.rows })
}))

// SEGURANÇA (varredura, item S3): antes era GET /cpf/:cpf — o CPF ia na própria URL e por isso
// ficava em log de proxy/servidor e no histórico do navegador, mesmo autenticado. Virou POST com o
// CPF no corpo da requisição, igual ao resto da API já fazia para outros dados sensíveis.
athletesRouter.post('/cpf-lookup', authenticate, authorize('admin', 'gestor'), asyncRoute(async (req, res) => {
  const input = parse(z.object({ cpf: z.string().min(1).max(20) }).strict(), req.body)
  const cpf = requireValidCpf(input.cpf)
  const result = await query(
    `SELECT a.id, a.team_id, a.name, a.status, a.created_at,
       t.name AS team_name, t.category
     FROM athletes a JOIN teams t ON t.id = a.team_id
     WHERE a.cpf_hash = $1 AND a.deleted_at IS NULL
       AND ($2::app_role = 'admin' OR t.manager_user_id = $3)
     ORDER BY a.created_at DESC`,
    [cpfDigest(cpf), req.user.role, req.user.id],
  )
  res.json({ cpf: maskCpf(cpf), registrations: result.rows })
}))

gestorAthletesRouter.use(authenticate, authorize('gestor'))
gestorAthletesRouter.get('/', asyncRoute(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : 'awaiting_manager'
  if (!['awaiting_manager', 'awaiting_admin', 'approved', 'rejected'].includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Status inválido')
  }
  const team = await userTeam(req.user.id)
  if (!team) return res.json({ athletes: [] })
  const result = await query(
    // LGPD (varredura, item L2): guardian_name/guardian_relationship aparecem aqui para o gestor
    // confirmar, na hora de aprovar, que um atleta menor de idade tem responsável identificado.
    `SELECT a.id, a.name, a.birthdate, a.age_at_registration, a.positions,
       a.status, a.justification, a.biometry_status, a.created_at,
       a.guardian_name, a.guardian_relationship
     FROM athletes a
     WHERE a.team_id = $1 AND a.status = $2 AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
    [team.id, status],
  )
  res.json({ athletes: result.rows })
}))

gestorAthletesRouter.post('/:athleteId/:action', asyncRoute(async (req, res) => {
  if (!['approve', 'reject'].includes(req.params.action)) throw notFound('Rota não encontrada')
  const justification = cleanText(req.body?.justification ?? '', 500)
  const athlete = await transaction(async (client) => {
    const result = await client.query(
      `SELECT a.*, t.name AS team_name, coalesce(u.email, a.contact_email) AS athlete_email
       FROM athletes a JOIN teams t ON t.id = a.team_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND t.manager_user_id = $2 AND a.deleted_at IS NULL
       FOR UPDATE OF a`,
      [req.params.athleteId, req.user.id],
    )
    const current = result.rows[0]
    if (!current) throw notFound('Atleta não encontrado')
    if (current.status !== 'awaiting_manager') throw new AppError(409, 'INVALID_TRANSITION', 'O atleta já foi analisado pelo gestor')
    const approved = req.params.action === 'approve'
    const updated = await client.query(
      `UPDATE athletes SET status = $2, justification = $3, updated_at = now()
       WHERE id = $1 RETURNING id, user_id, team_id, name, positions, status, biometry_status, created_at`,
      [current.id, approved ? 'awaiting_admin' : 'rejected', approved ? null : (justification || 'Sem justificativa informada')],
    )
    const managerMessage = approved
      ? `O atleta ${current.name} foi aprovado pelo gestor e aguarda a aprovação final do administrador.`
      : `O cadastro do atleta ${current.name} foi recusado pelo gestor.`
    await notify(client, 'admin', approved ? 'athlete_pending_admin' : 'athlete_rejected', 'Atualização de cadastro de atleta', managerMessage)
    if (current.athlete_email) {
      await enqueueEmail(client, {
        to: current.athlete_email,
        subject: approved ? 'Cadastro enviado para aprovação final - LVJ' : 'Cadastro de atleta recusado - LVJ',
        html: `<p>${escapeHtml(managerMessage)}</p>`,
        eventId: `athlete:${current.id}:manager:${req.params.action}`,
      })
    }
    // LGPD (varredura, item L3): mesma lógica do teams.js — o motivo já fica em athletes.justification;
    // a auditoria só registra se houve motivo, não o conteúdo (que pode mencionar dado do atleta).
    await audit(client, req.user, `athlete.manager_${req.params.action}`, 'athlete', current.id, { has_justification: Boolean(justification) })
    return updated.rows[0]
  })
  res.json({ athlete, email_sent_mock: false })
}))

export const adminAthleteActionsRouter = Router()
adminAthleteActionsRouter.use(authenticate, authorize('admin'))
adminAthleteActionsRouter.get('/', asyncRoute(async (req, res) => {
  const statusFilter = req.query.status === 'pending' ? 'awaiting_admin' : req.query.status || null
  if (statusFilter && !['awaiting_admin', 'awaiting_manager', 'approved', 'rejected'].includes(statusFilter)) {
    throw new AppError(400, 'INVALID_STATUS', 'Status inválido')
  }
  const result = await query(
    // LGPD (varredura, item L2): o admin faz a aprovação final — precisa ver quem é o responsável
    // legal de um atleta menor de idade antes de aprovar (toPublicAthlete mascara o CPF dele).
    `SELECT a.id, a.user_id, a.team_id, a.manager_user_id, a.name, a.birthdate,
       a.age_at_registration, a.positions, a.status, a.justification, a.biometry_url,
       a.biometry_status, a.control_id_reference, a.created_at, a.cpf_ciphertext, t.name AS team_name,
       t.category, u.name AS manager_name, u.email AS manager_email,
       a.guardian_name, a.guardian_cpf_ciphertext, a.guardian_relationship
     FROM athletes a JOIN teams t ON t.id = a.team_id
     JOIN users u ON u.id = a.manager_user_id
     WHERE a.deleted_at IS NULL AND ($1::athlete_status IS NULL OR a.status = $1)
     ORDER BY a.created_at DESC`,
    [statusFilter],
  )
  res.json({ athletes: result.rows.map(toPublicAthlete) })
}))

adminAthleteActionsRouter.post('/:athleteId/:action', asyncRoute(async (req, res) => {
  if (!['approve', 'reject'].includes(req.params.action)) throw notFound('Rota não encontrada')
  const justification = cleanText(req.body?.justification ?? '', 500)
  const athlete = await transaction(async (client) => {
    const result = await client.query(
      `SELECT a.*, t.name AS team_name, u.name AS manager_name, u.email AS manager_email
       FROM athletes a JOIN teams t ON t.id = a.team_id
       JOIN users u ON u.id = a.manager_user_id
       WHERE a.id = $1 AND a.deleted_at IS NULL FOR UPDATE OF a`,
      [req.params.athleteId],
    )
    const current = result.rows[0]
    if (!current) throw notFound('Atleta não encontrado')
    if (current.status !== 'awaiting_admin') throw new AppError(409, 'INVALID_TRANSITION', 'O atleta precisa da aprovação do gestor antes da análise final')
    const approved = req.params.action === 'approve'
    const updated = await client.query(
      `UPDATE athletes SET status = $2, justification = $3, updated_at = now()
       WHERE id = $1 RETURNING id, user_id, team_id, manager_user_id, name, birthdate,
       age_at_registration, positions, status, justification, biometry_url,
       biometry_status, control_id_reference, created_at`,
      [current.id, approved ? 'approved' : 'rejected', approved ? null : (justification || 'Sem justificativa informada')],
    )
    const message = approved
      ? `O atleta ${current.name} foi aprovado para a equipe ${current.team_name}.`
      : `O cadastro do atleta ${current.name} foi recusado pelo administrador.`
    await notify(client, current.manager_user_id, `athlete_admin_${req.params.action}`, 'Atualização de cadastro de atleta', message)
    await enqueueEmail(client, {
      to: current.manager_email,
      subject: approved ? `Atleta "${current.name}" aprovado - LVJ` : `Atleta "${current.name}" recusado - LVJ`,
      html: `<p>Olá ${escapeHtml(current.manager_name)},</p><p>${escapeHtml(message)}</p>`,
      eventId: `athlete:${current.id}:admin:${req.params.action}`,
    })
    if (approved && current.biometry_object_key) {
      await client.query(
        `INSERT INTO outbox_events (event_key, event_type, payload)
         VALUES ($1, 'biometry.sync', $2::jsonb) ON CONFLICT (event_key) DO NOTHING`,
        [`biometry:${current.id}`, JSON.stringify({ athleteId: current.id })],
      )
    }
    // LGPD (varredura, item L3): idem — ver comentário em athlete.manager_* acima.
    await audit(client, req.user, `athlete.admin_${req.params.action}`, 'athlete', current.id, { has_justification: Boolean(justification) })
    return updated.rows[0]
  })
  res.json({ athlete: toPublicAthlete(athlete), email_sent_mock: false })
}))
