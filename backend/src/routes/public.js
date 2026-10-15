import { Router } from 'express'
import { query } from '../db/pool.js'
import { asyncRoute, userTeam } from '../utils.js'
import { authenticate, authorize } from '../security/auth.js'

export const publicRouter = Router()

export const categories = [
  'Adulto Masculino', 'Adulto Feminino', 'Master Masculino',
  'Master Feminino', 'Sub-19 Masculino', 'Sub-19 Feminino',
]

publicRouter.get('/', (_req, res) => res.json({ message: 'LVJ API online', app: 'Liga de Voleibol Jundiaí' }))
publicRouter.get('/categories', (_req, res) => res.json({ categories }))
publicRouter.get('/approved-teams', asyncRoute(async (_req, res) => {
  const result = await query(
    `SELECT id, name, category FROM teams
     WHERE status = 'approved' AND deleted_at IS NULL ORDER BY category, name`,
  )
  res.json({ teams: result.rows })
}))
publicRouter.get('/sponsors', asyncRoute(async (_req, res) => {
  const result = await query('SELECT id, name, logo_url, website, tier, active FROM sponsors WHERE active = true AND deleted_at IS NULL ORDER BY name')
  res.json({ sponsors: result.rows })
}))

export const attendanceRouter = Router()
attendanceRouter.get('/mine', authenticate, authorize('gestor'), asyncRoute(async (req, res) => {
  const team = await userTeam(req.user.id)
  if (!team) return res.json({ attendance: [], team: null })
  const result = await query(
    `SELECT a.id AS athlete_id, a.name,
       count(att.id)::int AS total_sessions,
       count(att.id) FILTER (WHERE att.present)::int AS present
     FROM athletes a LEFT JOIN attendance att ON att.athlete_id = a.id AND att.deleted_at IS NULL
     WHERE a.team_id = $1 AND a.status = 'approved' AND a.deleted_at IS NULL
     GROUP BY a.id ORDER BY a.name`,
    [team.id],
  )
  const rules = await query('SELECT min_attendance_percent FROM rules WHERE id = $1', ['league_rules'])
  const minimum = Number(rules.rows[0]?.min_attendance_percent ?? 70)
  const attendance = result.rows.map((row) => {
    const percent = row.total_sessions ? Number(((row.present / row.total_sessions) * 100).toFixed(1)) : 0
    return { ...row, percent, min_required: minimum, eligible: percent >= minimum }
  })
  res.json({ attendance, team })
}))

attendanceRouter.get('/athlete/mine', authenticate, authorize('atleta'), asyncRoute(async (req, res) => {
  const result = await query(
    `SELECT att.id, att.match_id, att.attendance_date, att.present, att.source,
       m.home_name, m.away_name
     FROM athletes a JOIN attendance att ON att.athlete_id = a.id
     LEFT JOIN matches m ON m.id = att.match_id
     WHERE a.user_id = $1 AND a.deleted_at IS NULL AND att.deleted_at IS NULL
     ORDER BY att.attendance_date DESC`,
    [req.user.id],
  )
  res.json({ attendance: result.rows })
}))

export const approvedTeamsRouter = Router()
approvedTeamsRouter.get('/', authenticate, authorize('admin'), asyncRoute(async (req, res) => {
  const category = req.query.category ? String(req.query.category).slice(0, 80) : null
  const result = await query(
    `SELECT * FROM teams WHERE status = 'approved' AND deleted_at IS NULL
     AND ($1::text IS NULL OR category = $1) ORDER BY name`,
    [category],
  )
  res.json({ teams: result.rows })
}))
