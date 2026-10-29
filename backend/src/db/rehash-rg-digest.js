import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { pool, transaction } from './pool.js'
import { decryptSensitive, rgDigest } from '../security/crypto.js'

// SEGURANÇA (varredura, item 2): rg_hash trocou de SHA-256 sem chave para HMAC-SHA256 (ver
// security/crypto.js) — os valores já gravados com o algoritmo antigo precisam ser recalculados,
// senão a verificação de RG duplicado (backend/src/routes/athletes.js) para de reconhecer os
// cadastros existentes. Só rg_ciphertext guarda o RG em texto puro (decifrado aqui), então é a
// única fonte possível para recalcular o hash. Execução única, manual (igual era o antigo
// migrate-legacy.js) — não roda automaticamente no boot, porque decifrar toda a base a cada
// início de processo seria desnecessário depois da primeira vez.
//
// Idempotente: comparar o hash recalculado com o já salvo antes de fazer UPDATE, então rodar de
// novo (ex.: depois de um deploy parcial) só reprocessa quem ainda estiver com o valor antigo.
const LOCK_ID = 740219

async function rehash(client, table) {
  const rows = (await client.query(`SELECT id, rg_ciphertext, rg_hash FROM ${table} WHERE rg_ciphertext IS NOT NULL`)).rows
  let updated = 0
  for (const row of rows) {
    const newHash = rgDigest(decryptSensitive(row.rg_ciphertext))
    if (newHash !== row.rg_hash) {
      await client.query(`UPDATE ${table} SET rg_hash = $2 WHERE id = $1`, [row.id, newHash])
      updated += 1
    }
  }
  return { checked: rows.length, updated }
}

export async function rehashRgDigests() {
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID])
    const users = await rehash(client, 'users')
    const athletes = await rehash(client, 'athletes')
    return { users, athletes }
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await rehashRgDigests()
    console.info('rg_hash rehash concluído:', JSON.stringify(result))
  } catch (error) {
    console.error('rg_hash rehash falhou:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
