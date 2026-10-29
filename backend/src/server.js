import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db/pool.js'
import { runMigrations } from './db/migrate.js'
import { seedAdmin } from './db/seed-admin.js'
import { seedSponsorLogos } from './db/seed-sponsor-logos.js'
import { startQueueWorkers } from './services/queue.js'
import { initializeStorage } from './services/storage.js'
import { closeRateLimitStore } from './security/rate-limit.js'

let stopWorkers
let server

async function start() {
  await runMigrations()
  await seedAdmin()
  await initializeStorage()
  await seedSponsorLogos()
  stopWorkers = await startQueueWorkers()
  server = app.listen(config.PORT, '0.0.0.0', () => {
    console.info(`Liga Jundiaí API listening on port ${config.PORT}`)
  })
}

async function shutdown(signal) {
  console.info(`Received ${signal}; shutting down`)
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if (stopWorkers) await stopWorkers()
  await closeRateLimitStore()
  await pool.end()
}

process.on('SIGTERM', () => shutdown('SIGTERM').catch((error) => {
  console.error('Shutdown failed:', error)
  process.exitCode = 1
}))
process.on('SIGINT', () => shutdown('SIGINT').catch((error) => {
  console.error('Shutdown failed:', error)
  process.exitCode = 1
}))

start().catch(async (error) => {
  console.error('API startup failed:', error)
  await pool.end()
  process.exitCode = 1
})
