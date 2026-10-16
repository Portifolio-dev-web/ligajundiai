import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize } from '../security/auth.js'
import { decryptSensitive, maskCpf } from '../security/crypto.js'
import { cleanText, parse, uuidSchema } from '../security/validation.js'
import { categories, getRegistrationPeriods, registrationStatus } from '../services/registration.js'
import { asyncRoute, audit } from '../utils.js'

export const adminRouter = Router()
adminRouter.use(authenticate, authorize('admin'))

adminRouter.get('/registration-periods', asyncRoute(async (_req, res) => {
  res.json({ periods: await getRegistrationPeriods() })
}))

adminRouter.put('/registration-periods/:category/:type', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    category: z.enum(categories),
    type: z.enum(['team', 'athlete']),
  }).strict(), req.params)
  const window = parse(z.object({
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
  }).strict(), req.body)
  const startsAt = new Date(window.starts_at)
  const endsAt = new Date(window.ends_at)
  if (endsAt <= startsAt) throw new AppError(400, 'INVALID_REGISTRATION_PERIOD', 'A data final deve ser posterior à data inicial')

  const period = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO registration_periods
       (category, registration_type, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category, registration_type)
       DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
       RETURNING category, registration_type, starts_at, ends_at`,
      [input.category, input.type, startsAt, endsAt, req.user.id],
    )
    await audit(client, req.user, 'registration_period.configure', 'registration_period', `${input.category}:${input.type}`, {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    return result.rows[0]
  })
  res.json({ period: { ...period, status: registrationStatus(period) } })
}))

adminRouter.delete('/registration-periods/:category/:type', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    category: z.enum(categories),
    type: z.enum(['team', 'athlete']),
  }).strict(), req.params)
  await transaction(async (client) => {
    await client.query(
      'DELETE FROM registration_periods WHERE category = $1 AND registration_type = $2',
      [input.category, input.type],
    )
    await audit(client, req.user, 'registration_period.clear', 'registration_period', `${input.category}:${input.type}`)
  })
  res.json({ ok: true })
}))

adminRouter.get('/notifications', asyncRoute(async (_req, res) => {
  const [teams, athletes, notifications] = await Promise.all([
    query(`SELECT count(*)::int AS count FROM teams WHERE status = 'pending' AND deleted_at IS NULL`),
    query(`SELECT count(*)::int AS count FROM athletes WHERE status = 'awaiting_admin' AND deleted_at IS NULL`),
    query(`SELECT * FROM notifications WHERE target = 'admin' ORDER BY created_at DESC LIMIT 50`),
  ])
  const items = notifications.rows
  res.json({
    pending_teams: teams.rows[0].count,
    pending_athletes: athletes.rows[0].count,
    unread: items.filter((item) => !item.read).length,
    items,
  })
}))

adminRouter.post('/notifications/read-all', asyncRoute(async (_req, res) => {
  await query("UPDATE notifications SET read = true WHERE target = 'admin' AND read = false")
  res.json({ ok: true })
}))

adminRouter.post('/notifications/:notificationId/read', asyncRoute(async (req, res) => {
  const input = parse(z.object({ notificationId: uuidSchema }).strict(), req.params)
  await query("UPDATE notifications SET read = true WHERE id = $1 AND target = 'admin'", [input.notificationId])
  res.json({ ok: true })
}))

adminRouter.get('/stats', asyncRoute(async (_req, res) => {
  const result = await query(
    `SELECT
      (SELECT count(*)::int FROM teams WHERE status = 'approved' AND deleted_at IS NULL) AS teams,
      (SELECT count(*)::int FROM athletes WHERE status = 'approved' AND deleted_at IS NULL) AS athletes,
      (SELECT count(*)::int FROM matches WHERE deleted_at IS NULL) AS matches,
      (SELECT count(*)::int FROM teams WHERE status = 'pending' AND deleted_at IS NULL) AS pending_teams,
      (SELECT count(*)::int FROM athletes WHERE status = 'awaiting_admin' AND deleted_at IS NULL) AS pending_athletes`,
  )
  res.json(result.rows[0])
}))

adminRouter.get('/emails', asyncRoute(async (_req, res) => {
  const result = await query(
    `SELECT id, recipient AS "to", subject, html,
       CASE WHEN sent_at IS NULL THEN 'QUEUED' ELSE 'SENT' END AS status,
       created_at, sent_at
     FROM email_outbox ORDER BY created_at DESC LIMIT 50`,
  )
  res.json({ emails: result.rows })
}))

adminRouter.get('/logs', asyncRoute(async (_req, res) => {
  const result = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80')
  res.json({ logs: result.rows })
}))

adminRouter.get('/attendance', asyncRoute(async (req, res) => {
  const input = parse(z.object({ team_id: uuidSchema }).strict(), req.query)
  const result = await query(
    `SELECT a.id AS athlete_id, a.name, a.cpf_ciphertext,
       count(att.id)::int AS total_sessions,
       count(att.id) FILTER (WHERE att.present)::int AS present
     FROM athletes a LEFT JOIN attendance att ON att.athlete_id = a.id AND att.deleted_at IS NULL
     WHERE a.team_id = $1 AND a.status = 'approved' AND a.deleted_at IS NULL
     GROUP BY a.id ORDER BY a.name`,
    [input.team_id],
  )
  const rules = await query('SELECT min_attendance_percent FROM rules WHERE id = $1', ['league_rules'])
  const minimum = Number(rules.rows[0]?.min_attendance_percent ?? 70)
  const attendance = result.rows.map((row) => {
    const cpf = decryptSensitive(row.cpf_ciphertext)
    const percent = row.total_sessions ? Number(((row.present / row.total_sessions) * 100).toFixed(1)) : 0
    return {
      athlete_id: row.athlete_id,
      name: row.name,
      cpf: maskCpf(cpf),
      total_sessions: row.total_sessions,
      present: row.present,
      percent,
      min_required: minimum,
      eligible: percent >= minimum,
    }
  })
  res.json({ attendance })
}))

adminRouter.post('/attendance', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    team_id: uuidSchema,
    date: z.string().date().optional(),
    records: z.array(z.object({ athlete_id: uuidSchema, present: z.boolean() }).strict()).min(1).max(100),
  }).strict(), req.body)
  const attendanceDate = input.date || new Date().toISOString().slice(0, 10)
  await transaction(async (client) => {
    const team = await client.query(
      "SELECT id FROM teams WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL",
      [input.team_id],
    )
    if (!team.rowCount) throw new AppError(400, 'INVALID_TEAM', 'Equipe inválida')
    const athleteIds = [...new Set(input.records.map((record) => record.athlete_id))]
    const athletes = await client.query(
      `SELECT id FROM athletes WHERE id = ANY($1::uuid[]) AND team_id = $2
       AND status = 'approved' AND deleted_at IS NULL`,
      [athleteIds, input.team_id],
    )
    if (athletes.rowCount !== athleteIds.length) throw new AppError(400, 'INVALID_ATHLETE', 'Um ou mais atletas não pertencem à equipe ou não estão aprovados')
    for (const record of input.records) {
      await client.query(
        `INSERT INTO attendance (athlete_id, team_id, attendance_date, present, source)
         VALUES ($1, $2, $3, $4, 'manual')
         ON CONFLICT (athlete_id, attendance_date) WHERE match_id IS NULL AND deleted_at IS NULL
         DO UPDATE SET present = EXCLUDED.present, updated_at = now()`,
        [record.athlete_id, input.team_id, attendanceDate, record.present],
      )
    }
    await audit(client, req.user, 'attendance.register', 'team', input.team_id, { date: attendanceDate })
  })
  res.json({ ok: true })
}))

adminRouter.post('/sumula', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    team_id: uuidSchema,
    category: z.string().trim().min(1).max(80),
    date: z.string().date().optional(),
    filename: z.string().trim().min(1).max(200).optional().default('sumula.jpg'),
  }).strict(), req.body)
  const result = await query(
    `INSERT INTO sumulas (team_id, category, match_date, filename, note)
     VALUES ($1, $2, $3, $4, 'Importação registrada; OCR não configurado') RETURNING *`,
    [input.team_id, input.category, input.date || new Date().toISOString().slice(0, 10), cleanText(input.filename, 200)],
  )
  await query(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id)
     VALUES ($1, $2, 'sumula.upload', 'team', $3)`,
    [req.user.id, req.user.name, input.team_id],
  )
  res.status(201).json({ ok: true, sumula: result.rows[0], mocked: true })
}))

export const approveTeamRouter = Router()
approveTeamRouter.use(authenticate, authorize('admin'))
approveTeamRouter.post('/:teamId/:action', asyncRoute(async (req, res, next) => {
  if (!['approve', 'reject'].includes(req.params.action)) return next(notFound('Rota não encontrada'))
  next()
}))
