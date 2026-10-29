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

// SEGURANÇA: o guard de uso de categoria (categories.js#categoryUsage) e a criação de
// equipes/horários/janelas de inscrição sob aquela categoria rodavam em transações concorrentes
// sem nenhuma sincronização — sob READ COMMITTED (padrão do Postgres), um SELECT simples (como o
// de assertValidCategory acima) nunca é bloqueado pelo FOR UPDATE que o admin toma só na linha de
// categories, então uma criação podia confirmar depois que o admin já havia certificado "sem uso" e
// renomeado/excluído a categoria. Um advisory lock transacional, pela própria string da categoria,
// serializa os dois lados: quem pegar o lock primeiro (admin renomeando/excluindo, ou alguém
// criando um registro sob aquele nome) força o outro a esperar até o commit/rollback.
export async function lockCategoryName(client, name) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [name])
}
