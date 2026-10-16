import { query } from '../db/pool.js'
import { AppError } from '../errors.js'

export const categories = [
  'Adulto Masculino', 'Adulto Feminino', 'Master Masculino',
  'Master Feminino', 'Sub-19 Masculino', 'Sub-19 Feminino',
]

export const registrationTypes = ['team', 'athlete']

function executeQuery(executor, ...args) {
  return typeof executor === 'function'
    ? executor(...args)
    : executor.query(...args)
}

export function registrationStatus(period, now = new Date()) {
  if (!period) return 'not_configured'
  const current = now.getTime()
  if (current < new Date(period.starts_at).getTime()) return 'scheduled'
  if (current >= new Date(period.ends_at).getTime()) return 'closed'
  return 'open'
}

export function registrationMessage(type, status) {
  if (type === 'team' && ['closed', 'not_configured'].includes(status)) {
    return 'Inscrições encerradas, te aguardamos na próxima temporada.'
  }
  if (type === 'athlete' && ['closed', 'not_configured'].includes(status)) {
    return 'Obrigado pelo interesse em participar, Cadastro encerrado.'
  }
  if (status === 'scheduled') return 'As inscrições ainda não começaram.'
  return null
}

export async function getRegistrationPeriod(category, type, executor = query) {
  const result = await executeQuery(executor,
    `SELECT id, category, registration_type, starts_at, ends_at
     FROM registration_periods WHERE category = $1 AND registration_type = $2
     FOR SHARE`,
    [category, type],
  )
  return result.rows[0] ?? null
}

export async function assertRegistrationOpen(category, type, executor = query) {
  const period = await getRegistrationPeriod(category, type, executor)
  const status = registrationStatus(period)
  if (status !== 'open') {
    const code = type === 'team' ? 'TEAM_REGISTRATION_CLOSED' : 'ATHLETE_REGISTRATION_CLOSED'
    throw new AppError(403, code, registrationMessage(type, status))
  }
  return period
}

export async function getRegistrationPeriods(executor = query) {
  const result = await executeQuery(executor,
    `SELECT category, registration_type, starts_at, ends_at
     FROM registration_periods ORDER BY category, registration_type`,
  )
  const periods = new Map(result.rows.map((period) => [`${period.category}:${period.registration_type}`, period]))
  const now = new Date()
  return categories.flatMap((category) => registrationTypes.map((type) => {
    const period = periods.get(`${category}:${type}`) ?? null
    const status = registrationStatus(period, now)
    return {
      category,
      registration_type: type,
      starts_at: period?.starts_at ?? null,
      ends_at: period?.ends_at ?? null,
      status,
      message: registrationMessage(type, status),
    }
  }))
}
