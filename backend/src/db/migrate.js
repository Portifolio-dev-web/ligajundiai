import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { pool, transaction } from './pool.js'

const schemaPath = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url))

export async function runMigrations() {
  const schema = await readFile(schemaPath, 'utf8')
  await transaction(async (client) => {
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
