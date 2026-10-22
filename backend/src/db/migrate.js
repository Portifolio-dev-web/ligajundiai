import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { pool, transaction } from './pool.js'

const schemaPath = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url))

// SEGURANÇA (varredura, item S20): sem trava nenhuma, duas réplicas da API subindo ao mesmo tempo
// (deploy horizontal de verdade, não o "docker compose up" de um serviço só) rodariam CREATE
// TABLE/CREATE TRIGGER em paralelo — risco de erro de concorrência derrubando uma réplica logo na
// inicialização. Mesmo padrão já usado em seed-admin.js (pg_advisory_xact_lock), com um número de
// trava diferente para não se misturar com a trava da outra rotina.
const MIGRATION_LOCK_ID = 740218

export async function runMigrations() {
  const schema = await readFile(schemaPath, 'utf8')
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID])
    await client.query(schema)
  })
  console.info('PostgreSQL schema is ready')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await runMigrations()
  } catch (error) {
    console.error('PostgreSQL migration failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
