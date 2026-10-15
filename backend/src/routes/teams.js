import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize } from '../security/auth.js'
import { cleanText, parse } from '../security/validation.js'
import { enqueueEmail, escapeHtml } from '../services/email.js'
import { asyncRoute, audit, notify } from '../utils.js'

export const teamsRouter = Router()
export const adminTeamsRouter = Router()
const categories = [
  'Adulto Masculino', 'Adulto Feminino', 'Master Masculino',
  'Master Feminino', 'Sub-19 Masculino', 'Sub-19 Feminino',
]

teamsRouter.use(authenticate, authorize('gestor'))

teamsRouter.post('/', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(2).max(100),
    category: z.enum(categories),
  }).strict(), req.body)
  const team = await transaction(async (client) => {
    const userTeam = await client.query(
      'SELECT id FROM teams WHERE manager_user_id = $1 AND deleted_at IS NULL',
      [req.user.id],
    )
    if (userTeam.rowCount) throw new AppError(409, 'TEAM_ALREADY_EXISTS', 'Você já possui uma equipe cadastrada')
    const result = await client.query(
      `INSERT INTO teams (name, category, manager_user_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, category, manager_user_id, status, justification, created_at`,
      [cleanText(input.name, 100), input.category, req.user.id],
    )
    const row = result.rows[0]
    await notify(client, 'admin', 'team_pending', 'Nova equipe aguardando aprovação', `A equipe "${row.name}" (${row.category}) foi cadastrada por ${req.user.name}.`)
    await audit(client, req.user, 'team.request', 'team', row.id, { category: row.category })
    return row
  })
  res.status(201).json({ team })
}))

teamsRouter.get('/mine', asyncRoute(async (req, res) => {
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL LIMIT 1`,
    [req.user.id],
  )
  res.json({ team: result.rows[0] ?? null })
}))

adminTeamsRouter.use(authenticate, authorize('admin'))

adminTeamsRouter.get('/', asyncRoute(async (req, res) => {
  const status = req.query.status
  if (status && !['pending', 'approved', 'rejected'].includes(status)) throw new AppError(400, 'INVALID_STATUS', 'Status inválido')
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.deleted_at IS NULL AND ($1::team_status IS NULL OR t.status = $1)
     ORDER BY t.created_at DESC`,
    [status || null],
  )
  res.json({ teams: result.rows })
}))

adminTeamsRouter.post('/:teamId/:action', asyncRoute(async (req, res) => {
  if (!['approve', 'reject'].includes(req.params.action)) throw notFound('Rota não encontrada')
  const justification = cleanText(req.body?.justification ?? '', 500)
  const team = await transaction(async (client) => {
    const selected = await client.query(
      `SELECT t.*, u.name AS manager_name, u.email AS manager_email
       FROM teams t JOIN users u ON u.id = t.manager_user_id
       WHERE t.id = $1 AND t.deleted_at IS NULL FOR UPDATE OF t`,
      [req.params.teamId],
    )
    const current = selected.rows[0]
    if (!current) throw notFound('Equipe não encontrada')
    if (current.status !== 'pending') throw new AppError(409, 'INVALID_TRANSITION', 'A equipe já foi analisada')
    const approved = req.params.action === 'approve'
    const result = await client.query(
      `UPDATE teams SET status = $2, justification = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [current.id, approved ? 'approved' : 'rejected', approved ? null : (justification || 'Sem justificativa informada')],
    )
    const title = approved ? `Equipe "${current.name}" aprovada - LVJ` : `Equipe "${current.name}" recusada - LVJ`
    const message = approved
      ? `Sua equipe ${current.name} foi aprovada. Você já pode cadastrar atletas.`
      : `Sua equipe ${current.name} foi recusada. Motivo: ${justification || 'Sem justificativa informada'}`
    await notify(client, current.manager_user_id, `team_${req.params.action}`, title, message)
    await enqueueEmail(client, {
      to: current.manager_email,
      subject: title,
      html: `<p>Olá ${escapeHtml(current.manager_name)},</p><p>${escapeHtml(message)}</p>`,
      eventId: `team:${current.id}:${req.params.action}`,
    })
    await audit(client, req.user, `team.${req.params.action}`, 'team', current.id, { justification })
    return { ...result.rows[0], manager_name: current.manager_name, manager_email: current.manager_email }
  })
  res.json({ team, email_sent_mock: false })
}))

adminTeamsRouter.get('/approved', asyncRoute(async (req, res) => {
  const category = req.query.category || null
  const result = await query(
    `SELECT * FROM teams WHERE status = 'approved' AND deleted_at IS NULL
       AND ($1::text IS NULL OR category = $1) ORDER BY name`,
    [category],
  )
  res.json({ teams: result.rows })
}))
