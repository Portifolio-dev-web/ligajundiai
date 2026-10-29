import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/pool.js'
import { AppError, forbidden, notFound } from '../errors.js'
import { authenticate, authorize } from '../security/auth.js'
import { cleanText, parse, uuidSchema } from '../security/validation.js'
import { asyncRoute, audit, notify } from '../utils.js'
import { assertValidCategory, listCategoryNames, lockCategoryName } from '../services/categories.js'

export const gamesRouter = Router()
export const adminGamesRouter = Router()
export const gestorGamesRouter = Router()
export const matchesRouter = Router()

matchesRouter.get('/', asyncRoute(async (req, res) => {
  const category = req.query.category ? String(req.query.category).slice(0, 80) : null
  const status = req.query.status ? String(req.query.status) : null
  if (status && !['proposed', 'confirmed', 'scheduled', 'finished', 'cancelled'].includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Status de jogo inválido')
  }
  const result = await query(
    `SELECT * FROM matches WHERE deleted_at IS NULL
      AND ($1::text IS NULL OR category = $1)
      AND ($2::match_status IS NULL OR status = $2)
      ORDER BY scheduled_at`,
    [category, status],
  )
  res.json({ matches: result.rows })
}))

adminGamesRouter.use(authenticate, authorize('admin'))
adminGamesRouter.post('/game-dates', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    available_at: z.string().datetime(),
    venue: z.string().trim().max(200).optional().default(''),
    category: z.string().trim().min(1).max(80),
  }).strict(), req.body)
  // SEGURANÇA: lockCategoryName serializa esta criação contra o guard de uso de categoria
  // (categories.js#categoryUsage) — exige uma transação própria (pg_advisory_xact_lock só vale
  // dentro de uma transação) em vez dos query() soltos que este handler usava antes.
  const gameDate = await transaction(async (client) => {
    await lockCategoryName(client, input.category)
    await assertValidCategory(input.category, client)
    const result = await client.query(
      `INSERT INTO game_dates (available_at, venue, category, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.available_at, cleanText(input.venue, 200), input.category, req.user.id],
    )
    await audit(client, req.user, 'game_date.create', 'game_date', result.rows[0].id, { category: input.category })
    return result.rows[0]
  })
  res.status(201).json({ game_date: gameDate })
}))

adminGamesRouter.get('/game-dates', asyncRoute(async (req, res) => {
  const category = req.query.category ? String(req.query.category).slice(0, 80) : null
  const result = await query(
    `SELECT * FROM game_dates WHERE deleted_at IS NULL
       AND ($1::text IS NULL OR category = $1) ORDER BY available_at`,
    [category],
  )
  res.json({ game_dates: result.rows })
}))

adminGamesRouter.post('/matches', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    home_team_id: uuidSchema,
    away_team_id: uuidSchema,
    game_date_id: uuidSchema.optional(),
    scheduled_at: z.string().datetime().optional(),
    round: z.string().trim().max(80).optional().default(''),
    venue: z.string().trim().max(200).optional().default(''),
  }).strict(), req.body)
  const match = await transaction(async (client) => {
    const teams = await client.query(
      `SELECT id, name, category, manager_user_id FROM teams
       WHERE id = ANY($1::uuid[]) AND status = 'approved' AND deleted_at IS NULL`,
      [[input.home_team_id, input.away_team_id]],
    )
    if (teams.rowCount !== 2 || input.home_team_id === input.away_team_id) {
      throw new AppError(400, 'INVALID_TEAMS', 'Selecione duas equipes aprovadas e diferentes')
    }
    const home = teams.rows.find((team) => team.id === input.home_team_id)
    const away = teams.rows.find((team) => team.id === input.away_team_id)
    if (home.category !== away.category) throw new AppError(400, 'CATEGORY_MISMATCH', 'As equipes devem pertencer à mesma categoria')
    let scheduledAt = input.scheduled_at ?? new Date().toISOString()
    let venue = cleanText(input.venue, 200)
    if (input.game_date_id) {
      const gameDate = await client.query(
        'SELECT * FROM game_dates WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [input.game_date_id],
      )
      if (!gameDate.rowCount || gameDate.rows[0].category !== home.category) {
        throw new AppError(400, 'INVALID_GAME_DATE', 'A data não está disponível para esta categoria')
      }
      scheduledAt = gameDate.rows[0].available_at
      venue = gameDate.rows[0].venue
    }
    const result = await client.query(
      `INSERT INTO matches
       (game_date_id, category, round, home_team_id, away_team_id, home_name, away_name,
        scheduled_at, venue, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'proposed') RETURNING *`,
      [
        input.game_date_id ?? null, home.category, cleanText(input.round, 80),
        home.id, away.id, home.name, away.name, scheduledAt, venue,
      ],
    )
    for (const team of [home, away]) {
      await notify(client, team.manager_user_id, 'match_proposed', 'Nova sugestão de data de jogo', `${home.name} x ${away.name} aguarda seu aceite.`)
    }
    await audit(client, req.user, 'match.propose', 'match', result.rows[0].id)
    return result.rows[0]
  })
  res.status(201).json({ match })
}))

adminGamesRouter.put('/matches/:matchId/result', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    sets: z.array(z.object({
      home: z.coerce.number().int().min(0).max(100),
      away: z.coerce.number().int().min(0).max(100),
    }).strict()).min(3).max(5),
  }).strict(), req.body)
  const homeSets = input.sets.filter((set) => set.home > set.away).length
  const awaySets = input.sets.filter((set) => set.away > set.home).length
  if (Math.max(homeSets, awaySets) !== 3 || Math.min(homeSets, awaySets) > 2) {
    throw new AppError(400, 'INVALID_RESULT', 'O placar deve representar uma partida melhor de cinco sets')
  }
  const result = await query(
    `UPDATE matches SET sets = $2::jsonb, status = 'finished', updated_at = now()
     WHERE id = $1 AND status IN ('confirmed', 'scheduled') AND deleted_at IS NULL RETURNING *`,
    [req.params.matchId, JSON.stringify(input.sets)],
  )
  if (!result.rowCount) throw new AppError(409, 'MATCH_NOT_READY', 'O jogo precisa estar confirmado antes de registrar o resultado')
  await query(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'match.result', 'match', $3, $4::jsonb)`,
    [req.user.id, req.user.name, req.params.matchId, JSON.stringify({ sets: input.sets })],
  )
  res.json({ match: result.rows[0] })
}))

gestorGamesRouter.use(authenticate, authorize('gestor'))
gestorGamesRouter.post('/:matchId/accept', asyncRoute(async (req, res) => {
  const match = await transaction(async (client) => {
    // Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe aprovada,
    // então o aceite precisa procurar o jogo em TODAS elas, não só na primeira encontrada.
    const teams = await client.query(
      'SELECT id FROM teams WHERE manager_user_id = $1 AND status = $2 AND deleted_at IS NULL',
      [req.user.id, 'approved'],
    )
    if (!teams.rowCount) throw forbidden('Somente gestores de equipes aprovadas podem aceitar jogos')
    const teamIds = teams.rows.map((team) => team.id)
    const selected = await client.query(
      'SELECT * FROM matches WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [req.params.matchId],
    )
    const current = selected.rows[0]
    if (!current) throw notFound('Jogo não encontrado')
    const myTeamId = [current.home_team_id, current.away_team_id].find((id) => teamIds.includes(id))
    if (!myTeamId) throw forbidden('Este jogo não foi proposto para sua equipe')
    if (current.status !== 'proposed') throw new AppError(409, 'INVALID_TRANSITION', 'Este jogo não está aguardando aceite')
    const side = current.home_team_id === myTeamId ? 'home_accepted_at' : 'away_accepted_at'
    const updated = await client.query(
      `UPDATE matches SET ${side} = now(),
         status = CASE
           WHEN (home_accepted_at IS NOT NULL OR $2 = 'home_accepted_at')
            AND (away_accepted_at IS NOT NULL OR $2 = 'away_accepted_at') THEN 'confirmed'::match_status
           ELSE status END,
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [current.id, side],
    )
    await audit(client, req.user, 'match.accept', 'match', current.id, { team_id: myTeamId })
    return updated.rows[0]
  })
  res.json({ match })
}))

export const scheduleRouter = Router()
scheduleRouter.get('/standings', asyncRoute(async (req, res) => {
  let category = req.query.category ? String(req.query.category).slice(0, 80) : ''
  if (!category) {
    const [firstCategory] = await listCategoryNames()
    category = firstCategory ?? ''
  }
  const teams = await query(
    `SELECT id, name FROM teams WHERE category = $1 AND status = 'approved' AND deleted_at IS NULL`,
    [category],
  )
  const rulesResult = await query('SELECT points, tiebreakers FROM rules WHERE id = $1', ['league_rules'])
  const rules = rulesResult.rows[0] ?? {}
  const table = new Map(teams.rows.map((team) => [team.id, {
    team_id: team.id, name: team.name, played: 0, wins: 0, losses: 0, points: 0,
    sets_won: 0, sets_lost: 0, rally_for: 0, rally_against: 0,
  }]))
  const matches = await query(
    `SELECT home_team_id, away_team_id, sets FROM matches
     WHERE category = $1 AND status = 'finished' AND deleted_at IS NULL`,
    [category],
  )
  for (const match of matches.rows) {
    const home = table.get(match.home_team_id)
    const away = table.get(match.away_team_id)
    if (!home || !away) continue
    let homeSets = 0; let awaySets = 0; let homePoints = 0; let awayPoints = 0
    for (const set of match.sets) {
      const h = Number(set.home) || 0; const a = Number(set.away) || 0
      if (h > a) homeSets += 1
      if (a > h) awaySets += 1
      homePoints += h; awayPoints += a
    }
    home.played += 1; away.played += 1
    home.sets_won += homeSets; home.sets_lost += awaySets
    away.sets_won += awaySets; away.sets_lost += homeSets
    home.rally_for += homePoints; home.rally_against += awayPoints
    away.rally_for += awayPoints; away.rally_against += homePoints
    const winner = homeSets > awaySets ? home : away
    const loser = homeSets > awaySets ? away : home
    const score = `${Math.max(homeSets, awaySets)}x${Math.min(homeSets, awaySets)}`
    const points = rules.points ?? {}
    winner.wins += 1; loser.losses += 1
    winner.points += Number(points[`win_${score.replace('x', '_')}`] ?? 0)
    loser.points += Number(points[`loss_${score.replace('x', '_')}`] ?? 0)
  }
  const tieBreakers = rules.tiebreakers ?? ['points', 'wins', 'sets_ratio', 'points_ratio']
  const standings = [...table.values()].map((team) => ({
    ...team,
    sets_ratio: team.sets_lost ? Number((team.sets_won / team.sets_lost).toFixed(3)) : team.sets_won,
    points_ratio: team.rally_against ? Number((team.rally_for / team.rally_against).toFixed(3)) : team.rally_for,
  })).sort((a, b) => {
    for (const key of tieBreakers) if ((b[key] ?? 0) !== (a[key] ?? 0)) return (b[key] ?? 0) - (a[key] ?? 0)
    return a.name.localeCompare(b.name)
  }).map((team, index) => ({ position: index + 1, ...team }))
  res.json({ category, standings })
}))

export const adminRulesRouter = Router()
adminRulesRouter.get('/', asyncRoute(async (_req, res) => {
  const result = await query('SELECT * FROM rules WHERE id = $1', ['league_rules'])
  res.json({ rules: result.rows[0] ?? null })
}))

adminRulesRouter.put('/', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const input = parse(z.object({
    points: z.record(z.string(), z.number().int().min(0).max(10)),
    tiebreakers: z.array(z.enum(['points', 'wins', 'sets_ratio', 'points_ratio'])).min(1).max(4),
    min_attendance_percent: z.coerce.number().min(0).max(100),
  }), req.body)
  const result = await query(
    `UPDATE rules SET points = $1::jsonb, tiebreakers = $2::jsonb,
      min_attendance_percent = $3, updated_at = now()
     WHERE id = 'league_rules' RETURNING *`,
    [JSON.stringify(input.points), JSON.stringify(input.tiebreakers), input.min_attendance_percent],
  )
  await query(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'rules.update', 'rules', 'league_rules', $3::jsonb)`,
    [req.user.id, req.user.name, JSON.stringify(input)],
  )
  res.json({ rules: result.rows[0] })
}))
