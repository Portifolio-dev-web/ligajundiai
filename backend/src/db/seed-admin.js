import { config } from '../config.js'
import { pool, transaction } from './pool.js'
import { hashPassword } from '../security/auth.js'
import { encryptSensitive } from '../security/crypto.js'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export async function seedAdmin() {
  const passwordHash = await hashPassword(config.ADMIN_PASSWORD)
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [740219])
    const existing = await client.query(
      'SELECT id, role FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL',
      [config.ADMIN_EMAIL],
    )
    if (existing.rowCount) {
      if (existing.rows[0].role !== 'admin') throw new Error('ADMIN_EMAIL is already assigned to a non-admin account')
      await client.query(
        'UPDATE users SET totp_secret_ciphertext = $2, updated_at = now() WHERE id = $1',
        [existing.rows[0].id, encryptSensitive(config.ADMIN_TOTP_SECRET)],
      )
      return
    }
    await client.query(
      `INSERT INTO users
       (role, name, email, password_hash, totp_secret_ciphertext, consent_at, consent_version)
       VALUES ('admin', 'Administrador LVJ', $1, $2, $3, now(), $4)`,
      [config.ADMIN_EMAIL.toLowerCase(), passwordHash, encryptSensitive(config.ADMIN_TOTP_SECRET), config.CONSENT_VERSION],
    )
  })
  console.info(`Administrator seed verified for ${config.ADMIN_EMAIL}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await seedAdmin()
  } catch (error) {
    console.error('Administrator seed failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
