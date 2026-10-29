import { randomUUID } from 'node:crypto'
import { query } from './db/pool.js'
import { decryptSensitive, maskRg } from './security/crypto.js'

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

// SEGURANÇA (varredura, itens 8 e 9): privacy.js (exclusão a pedido do titular) e retention.js
// (varredura de retenção) nulavam biometry_object_key/control_id_reference e só então, DEPOIS do
// commit, tentavam apagar o objeto no S3/revogar no Control-ID — sem try/catch, sem retentativa, e
// sem guardar a chave/referência em lugar nenhum se a chamada falhasse (fica um objeto órfão no S3
// e um registro biométrico esquecido no fornecedor, nos dois casos sem qualquer trilha). Agora a
// obrigação de limpeza entra no outbox na MESMA transação que zera as colunas — mesmo padrão já
// usado por email/sms/biometry.sync (services/queue.js), com a durabilidade/retentativa do BullMQ.
export async function enqueuePendingBiometryCleanup(client, athleteId, { biometryObjectKey, controlIdReference }) {
  if (biometryObjectKey) {
    await client.query(
      `INSERT INTO outbox_events (event_key, event_type, payload)
       VALUES ($1, 'biometry.delete', $2::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [`biometry-delete:${athleteId}`, JSON.stringify({ key: biometryObjectKey })],
    )
  }
  if (controlIdReference) {
    await client.query(
      `INSERT INTO outbox_events (event_key, event_type, payload)
       VALUES ($1, 'controlid.revoke', $2::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [`controlid-revoke:${athleteId}`, JSON.stringify({ reference: controlIdReference, athleteId })],
    )
  }
}

// Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe, então não existe
// mais "a equipe do gestor" no singular — userTeams lista todas, e teamForManager busca uma
// equipe específica já confirmando que ela pertence a este gestor (ownership check).
export async function userTeams(userId) {
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.manager_user_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at`,
    [userId],
  )
  return result.rows
}

export async function teamForManager(userId, teamId) {
  const result = await query(
    `SELECT t.*, u.name AS manager_name, u.email AS manager_email
     FROM teams t JOIN users u ON u.id = t.manager_user_id
     WHERE t.id = $1 AND t.manager_user_id = $2 AND t.deleted_at IS NULL LIMIT 1`,
    [teamId, userId],
  )
  return result.rows[0] ?? null
}

export function toPublicAthlete(row) {
  if (!row) return row
  // LGPD (varredura, item L2): o RG do responsável legal (menores de idade) segue a mesma regra do
  // RG do próprio atleta — nunca sai em texto puro da API, só mascarado.
  const { rg_ciphertext, rg_hash, guardian_rg_ciphertext, ...safe } = row
  return {
    ...safe,
    ...(rg_ciphertext ? { rg: maskRg(decryptSensitive(rg_ciphertext)) } : {}),
    ...(guardian_rg_ciphertext ? { guardian_rg: maskRg(decryptSensitive(guardian_rg_ciphertext)) } : {}),
  }
}

export function newEventKey(type, id) {
  return `${type}:${id}:${randomUUID()}`
}
