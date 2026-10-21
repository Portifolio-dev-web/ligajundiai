import { query } from '../db/pool.js'
import { AppError } from '../errors.js'

function executeQuery(executor, ...args) {
  return typeof executor === 'function'
    ? executor(...args)
    : executor.query(...args)
}

export async function listCategories({ includeInactive = false } = {}, executor = query) {
  const result = await executeQuery(
    executor,
    `SELECT id, name, abbreviation, sort_order, active, created_at, updated_at
     FROM categories
     ${includeInactive ? '' : 'WHERE active = true'}
     ORDER BY sort_order, name`,
  )
  return result.rows
}

export async function listCategoryNames(executor = query) {
  const rows = await listCategories({ includeInactive: false }, executor)
  return rows.map((row) => row.name)
}

export async function assertValidCategory(name, executor = query) {
  const result = await executeQuery(executor, 'SELECT 1 FROM categories WHERE name = $1 AND active = true', [name])
  if (result.rowCount === 0) throw new AppError(400, 'INVALID_CATEGORY', 'Categoria inválida ou inativa')
}
