import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { config } from '../config.js'
import { parse, uuidSchema } from '../security/validation.js'
import { asyncRoute, audit } from '../utils.js'

export const webhooksRouter = Router()

webhooksRouter.post('/turnstile', asyncRoute(async (req, res) => {
  const timestamp = Number(req.header('x-lvj-timestamp'))
  const signature = req.header('x-lvj-signature') || ''
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
    throw new AppError(401, 'INVALID_WEBHOOK_TIMESTAMP', 'Timestamp do webhook inválido ou expirado')
  }
  const expected = createHmac('sha256', config.WEBHOOK_SECRET)
    .update(`${timestamp}.`)
    .update(req.rawBody)
    .digest()
  let actual
  try {
    actual = Buffer.from(signature, 'hex')
  } catch {
    actual = Buffer.alloc(0)
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Assinatura do webhook inválida')
  }

  const input = parse(z.object({
    event_id: z.string().trim().min(1).max(200),
    match_id: uuidSchema,
    control_id_reference: z.string().trim().min(1).max(200),
    occurred_at: z.string().datetime(),
  }).strict(), req.body)

  const result = await transaction(async (client) => {
    const athlete = await client.query(
      `SELECT id, team_id FROM athletes
       WHERE control_id_reference = $1 AND status = 'approved'
         AND biometry_status = 'synced' AND deleted_at IS NULL`,
      [input.control_id_reference],
    )
    if (!athlete.rowCount) throw notFound('Atleta aprovado não encontrado')
    const match = await client.query(
      `SELECT id, home_team_id, away_team_id, scheduled_at
       FROM matches WHERE id = $1 AND status IN ('confirmed', 'scheduled') AND deleted_at IS NULL`,
      [input.match_id],
    )
    const game = match.rows[0]
    if (!game || ![game.home_team_id, game.away_team_id].includes(athlete.rows[0].team_id)) {
      throw new AppError(400, 'ATHLETE_NOT_IN_MATCH', 'O atleta não pertence a uma das equipes deste jogo')
    }
    const occurredAt = new Date(input.occurred_at)
    if (Math.abs(occurredAt.getTime() - new Date(game.scheduled_at).getTime()) > 24 * 60 * 60 * 1000) {
      throw new AppError(400, 'ACCESS_OUTSIDE_GAME_WINDOW', 'O acesso está fora da janela do jogo')
    }
    const webhookEvent = await client.query(
      `INSERT INTO webhook_events (event_id, event_type, received_at)
       VALUES ($1, 'turnstile.access', now()) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [input.event_id],
    )
    if (!webhookEvent.rowCount) return false
    await client.query(
      `INSERT INTO attendance (athlete_id, match_id, team_id, attendance_date, present, source, source_event_id)
       VALUES ($1, $2, $3, $4, true, 'turnstile', $5)
       ON CONFLICT (athlete_id, match_id) WHERE match_id IS NOT NULL AND deleted_at IS NULL
       DO UPDATE SET present = true, source = 'turnstile', updated_at = now()`,
      [athlete.rows[0].id, game.id, athlete.rows[0].team_id, occurredAt.toISOString().slice(0, 10), input.event_id],
    )
    await audit(client, null, 'attendance.turnstile', 'match', game.id, { event_id: input.event_id })
    return true
  })
  res.status(result ? 201 : 200).json({ ok: true, duplicate: !result })
}))
