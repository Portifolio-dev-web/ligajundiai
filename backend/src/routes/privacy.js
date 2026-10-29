import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import argon2 from 'argon2'
import { query, transaction } from '../db/pool.js'
import { AppError } from '../errors.js'
import { authenticate, sessionCookieName, sessionCookieOptions } from '../security/auth.js'
import { asyncRoute, audit, enqueuePendingBiometryCleanup } from '../utils.js'
import { exportRateLimit } from '../security/rate-limit.js'

export const privacyRouter = Router()
// LGPD: deliberadamente SEM requireCurrentConsent (ver security/auth.js) — o direito de exportar
// ou excluir os próprios dados não pode depender de aceitar uma versão nova da Política/Termos
// primeiro. Bloquear isso até o reconsentimento transformaria o próprio mecanismo de proteção da
// LGPD numa forma de reter a pessoa no sistema contra a vontade dela.
privacyRouter.use(authenticate)

// SEGURANÇA (varredura, item S16): antes só exigia sessão válida — uma sessão vazada/roubada
// raspava os dados pessoais do titular (inclusive do responsável legal de um menor) repetidamente,
// sem fricção nenhuma.
privacyRouter.get('/export', exportRateLimit, asyncRoute(async (req, res) => {
  const user = await query(
    `SELECT id, role, name, email, phone, consent_at, consent_version, created_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.user.id],
  )
  const teams = await query('SELECT id, name, category, status, created_at FROM teams WHERE manager_user_id = $1 AND deleted_at IS NULL', [req.user.id])
  // LGPD (varredura, item L2): a exportação inclui também os dados do responsável legal, quando
  // houver (atleta menor de idade) — são dados pessoais ligados a este cadastro, então entram no
  // mesmo pedido de acesso do titular, igual recomenda a referência de LGPD do time de segurança.
  const athletes = await query(
    `SELECT id, team_id, name, birthdate, positions, status, biometry_status, created_at,
       guardian_name, guardian_relationship
     FROM athletes WHERE (user_id = $1 OR manager_user_id = $1) AND deleted_at IS NULL`,
    [req.user.id],
  )
  const attendance = await query(
    `SELECT att.id, att.athlete_id, att.match_id, att.attendance_date, att.present, att.source
     FROM attendance att JOIN athletes a ON a.id = att.athlete_id
     WHERE (a.user_id = $1 OR a.manager_user_id = $1) AND att.deleted_at IS NULL`,
    [req.user.id],
  )
  res.json({ user: user.rows[0], teams: teams.rows, athletes: athletes.rows, attendance: attendance.rows })
}))

privacyRouter.delete('/me', asyncRoute(async (req, res) => {
  if (req.body?.confirm !== true) throw new AppError(400, 'CONFIRMATION_REQUIRED', 'Confirme explicitamente a exclusão dos dados')
  await transaction(async (client) => {
    const result = await client.query(
      `SELECT id, biometry_object_key, control_id_reference FROM athletes
       WHERE (user_id = $1 OR manager_user_id = $1) AND deleted_at IS NULL FOR UPDATE`,
      [req.user.id],
    )
    const now = new Date()
    // LGPD (varredura, item L2): a referência de LGPD do time de segurança descreve um achado real
    // em outro sistema — a anonimização apagava o titular e deixava nome/RG do responsável para
    // trás. Por isso guardian_name/guardian_rg_ciphertext/guardian_relationship entram aqui junto
    // com os outros campos identificáveis do atleta.
    await client.query(
      `UPDATE athletes SET name = 'Atleta anonimizado', rg_ciphertext = NULL, rg_hash = NULL,
         birthdate = NULL, age_at_registration = NULL, positions = '{}', biometry_url = NULL,
         biometry_object_key = NULL, control_id_reference = NULL,
         guardian_name = NULL, guardian_rg_ciphertext = NULL, guardian_relationship = NULL,
         deleted_at = $2, updated_at = $2
       WHERE (user_id = $1 OR manager_user_id = $1) AND deleted_at IS NULL`,
      [req.user.id, now],
    )
    await client.query(
      `UPDATE teams SET name = 'Equipe anonimizada', deleted_at = $2, updated_at = $2
       WHERE manager_user_id = $1 AND deleted_at IS NULL`,
      [req.user.id, now],
    )
    const anonymizedEmail = `deleted+${req.user.id}@invalid.local`
    const passwordHash = await argon2.hash(randomBytes(48).toString('hex'), { type: argon2.argon2id })
    await client.query(
      `UPDATE users SET name = 'Usuário anonimizado', email = $2, password_hash = $3,
         phone = NULL, rg_ciphertext = NULL, rg_hash = NULL, totp_secret_ciphertext = NULL,
         status = 'suspended', deleted_at = $4, updated_at = $4 WHERE id = $1`,
      [req.user.id, anonymizedEmail, passwordHash, now],
    )
    await client.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id, now])
    for (const row of result.rows) {
      await enqueuePendingBiometryCleanup(client, row.id, {
        biometryObjectKey: row.biometry_object_key,
        controlIdReference: row.control_id_reference,
      })
    }
    await audit(client, req.user, 'privacy.anonymize', 'user', req.user.id)
  })
  // SEGURANÇA (varredura, item S18): usava o nome e as opções do cookie fixos e divergentes do
  // resto do código (sameSite sempre 'lax', nunca o prefixo __Host-) — em produção isso limpava o
  // cookie errado e deixava a sessão de pé depois da anonimização.
  res.clearCookie(sessionCookieName(), sessionCookieOptions())
  res.status(204).end()
}))
