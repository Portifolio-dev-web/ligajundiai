import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize } from '../security/auth.js'
import { cleanText, justificationSchema, parse } from '../security/validation.js'
import { enqueueEmail, escapeHtml } from '../services/email.js'
import { assertRegistrationOpen } from '../services/registration.js'
import { assertValidCategory } from '../services/categories.js'
import { financialResponsibilityTerm, consentTextHash } from '../services/legalTexts.js'
import { asyncRoute, audit, notify } from '../utils.js'

export const teamsRouter = Router()
export const adminTeamsRouter = Router()
teamsRouter.use(authenticate, authorize('gestor'))

teamsRouter.post('/', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(2).max(100),
    category: z.string().trim().min(1).max(80),
    // Risco 3 (análise LVJ 2027): o Termo de Responsabilidade Financeira ("me responsabilizando
    // pela equipe X, inscrita na categoria Y... aceito o artigo 7º") é específico da equipe, então
    // o aceite dele é exigido aqui, na criação da equipe — não no cadastro da conta do gestor.
    consent: z.literal(true),
    consent_version: z.string().trim().max(40).optional(),
  }).strict(), req.body)
  const team = await transaction(async (client) => {
    await assertValidCategory(input.category, client)
    await assertRegistrationOpen(input.category, 'team', client)
    // Risco 1 (varredura, análise LVJ 2027): um gestor pode gerenciar mais de uma equipe, em
    // categorias diferentes, com um único login — por isso não há mais bloqueio aqui por já
    // existir uma equipe. teams_name_category_active_uq ainda impede duas equipes com o mesmo
    // nome na mesma categoria.
    const result = await client.query(
      `INSERT INTO teams (name, category, manager_user_id, consent_at, consent_version)
       VALUES ($1, $2, $3, now(), $4)
       RETURNING id, name, category, manager_user_id, status, justification, created_at`,
      [cleanText(input.name, 100), input.category, req.user.id, input.consent_version || config.CONSENT_VERSION],
    )
    const row = result.rows[0]
    await notify(client, 'admin', 'team_pending', 'Nova equipe aguardando aprovação', `A equipe "${row.name}" (${row.category}) foi cadastrada por ${req.user.name}.`)
    await audit(client, req.user, 'team.request', 'team', row.id, { category: row.category })
    // LGPD (risco 4, análise LVJ 2027): mesma lógica do consentimento do gestor e do atleta — trilha
    // separada e imutável para o Termo de Responsabilidade Financeira, que sobrevive mesmo se a
    // equipe for removida/anonimizada depois.
    // LGPD (varredura, item L5): ip + hash do texto exato do Termo de Responsabilidade Financeira
    // (com o nome/categoria já preenchidos, igual ao que a pessoa leu na tela) — ver legalTexts.js.
    await audit(client, req.user, 'consent.recorded', 'team', row.id, {
      consent_version: input.consent_version || config.CONSENT_VERSION,
      category: row.category,
      ip: req.ip,
      consent_text_sha256: consentTextHash(financialResponsibilityTerm({ teamName: row.name, category: row.category })),
    })
    return row
  })
  res.status(201).json({ team })
}))

teamsRouter.get('/mine', asyncRoute(async (req, res) => {
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at`,
    [req.user.id],
  )
  res.json({ teams: result.rows })
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
  const input = parse(justificationSchema, req.body ?? {})
  const justification = cleanText(input.justification ?? '', 500)
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
    // LGPD (varredura, item L3): a trilha de auditoria não guarda o texto do motivo — ele já está
    // em teams.justification, visível só para quem já pode ver aquela equipe. audit_logs é lido em
    // bloco por qualquer admin (GET /admin/logs), então só registra SE um motivo foi dado, não qual.
    await audit(client, req.user, `team.${req.params.action}`, 'team', current.id, { has_justification: Boolean(justification) })
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
