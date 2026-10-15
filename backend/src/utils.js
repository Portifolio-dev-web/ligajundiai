import { randomUUID } from 'node:crypto'
import { query } from './db/pool.js'
import { decryptSensitive, maskCpf } from './security/crypto.js'

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

export async function audit(client, actor, action, entityType, entityId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [actor?.id ?? null, actor?.name ?? 'system', action, entityType, String(entityId), JSON.stringify(metadata)],
  )
}

export async function notify(client, target, type, title, body) {
  await client.query(
    'INSERT INTO notifications (target, type, title, body) VALUES ($1, $2, $3, $4)',
    [target, type, title, body],
  )
}

export async function userTeam(userId) {
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL LIMIT 1`,
    [userId],
  )
  return result.rows[0] ?? null
}

export function toPublicAthlete(row) {
  if (!row) return row
  const { cpf_ciphertext, cpf_hash, ...safe } = row
  return { ...safe, ...(cpf_ciphertext ? { cpf: maskCpf(decryptSensitive(cpf_ciphertext)) } : {}) }
}

export function newEventKey(type, id) {
  return `${type}:${id}:${randomUUID()}`
}
