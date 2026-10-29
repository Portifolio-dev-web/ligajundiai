import { config } from '../config.js'
import { transaction } from '../db/pool.js'
import { audit, enqueuePendingBiometryCleanup } from '../utils.js'

// LGPD (varredura, item L9): a eliminação dependia 100% do titular pedir via DELETE /privacy/me —
// não havia processo que identificasse e eliminasse dados sem base legal remanescente. Um cadastro
// de atleta recusado não tem mais base legal (a execução de contrato que justificava guardar RG e
// biometria terminou na recusa), então esta rotina periódica (ver services/queue.js) anonimiza o
// que passou do prazo configurado em RETENTION_REJECTED_ATHLETE_DAYS, sem esperar pedido de ninguém.
export async function sweepExpiredRetention() {
  const cutoff = new Date(Date.now() - config.RETENTION_REJECTED_ATHLETE_DAYS * 24 * 60 * 60 * 1000)
  const ids = await transaction(async (client) => {
    const expired = await client.query(
      `SELECT id, biometry_object_key, control_id_reference FROM athletes
       WHERE status = 'rejected' AND deleted_at IS NULL AND updated_at < $1
       FOR UPDATE`,
      [cutoff],
    )
    if (!expired.rowCount) return []
    const expiredIds = expired.rows.map((row) => row.id)
    const now = new Date()
    // Mesmos campos zerados que a anonimização sob pedido do titular (privacy.js), incluindo os
    // dados do responsável legal do menor (LGPD, item L2) e o novo consentimento biométrico (L4).
    await client.query(
      `UPDATE athletes SET name = 'Atleta anonimizado', rg_ciphertext = NULL, rg_hash = NULL,
         birthdate = NULL, age_at_registration = NULL, positions = '{}', biometry_url = NULL,
         biometry_object_key = NULL, control_id_reference = NULL, biometric_consent_at = NULL,
         guardian_name = NULL, guardian_rg_ciphertext = NULL, guardian_relationship = NULL,
         deleted_at = $2, updated_at = $2
       WHERE id = ANY($1::uuid[])`,
      [expiredIds, now],
    )
    for (const row of expired.rows) {
      await audit(client, null, 'privacy.retention_anonymize', 'athlete', row.id, {
        reason: 'rejected_registration_retention_expired',
        retention_days: config.RETENTION_REJECTED_ATHLETE_DAYS,
      })
      await enqueuePendingBiometryCleanup(client, row.id, {
        biometryObjectKey: row.biometry_object_key,
        controlIdReference: row.control_id_reference,
      })
    }
    return expiredIds
  })
  if (ids.length) console.info(`Retention sweep: anonymized ${ids.length} expired rejected athlete registration(s).`)
  return ids.length
}
