import IORedis from 'ioredis'
import { Queue, Worker } from 'bullmq'
import { config } from '../config.js'
import { query } from '../db/pool.js'
import { sendQueuedEmail, enqueueOutboxEvents } from './email.js'
import { createBiometryReadUrl, readBiometry } from './storage.js'

const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null })
export const jobsQueue = new Queue('lvj-jobs', { connection })

async function syncAthleteBiometry({ athleteId }) {
  const result = await query(
    `SELECT id, name, biometry_object_key FROM athletes
     WHERE id = $1 AND status = 'approved' AND deleted_at IS NULL`,
    [athleteId],
  )
  const athlete = result.rows[0]
  if (!athlete?.biometry_object_key) return
  const image = await readBiometry(athlete.biometry_object_key)
  const imageBytes = await image.transformToByteArray()
  const imageUrl = await createBiometryReadUrl(athlete.biometry_object_key)
  if (config.CONTROL_ID_MODE === 'live') {
    const response = await fetch(`${config.CONTROL_ID_API_URL.replace(/\/$/, '')}/persons`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.CONTROL_ID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        external_id: athlete.id,
        name: athlete.name,
        image_url: imageUrl,
        image_size_bytes: imageBytes.byteLength,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Control ID returned HTTP ${response.status}`)
    const result = await response.json()
    if (!result.reference) throw new Error('Control ID response is missing the external reference')
    await query(
      `UPDATE athletes SET biometry_status = 'synced', control_id_reference = $2, updated_at = now()
       WHERE id = $1`,
      [athlete.id, String(result.reference)],
    )
  } else {
    await query(
      `UPDATE athletes SET biometry_status = 'synced', control_id_reference = $2, updated_at = now()
       WHERE id = $1`,
      [athlete.id, `simulation:${athlete.id}`],
    )
    console.info(`Control ID simulation completed for athlete ${athlete.id}`)
  }
}

export async function startQueueWorkers() {
  const worker = new Worker('lvj-jobs', async (job) => {
    if (job.name === 'email.send') return sendQueuedEmail(job.data.emailId)
    if (job.name === 'biometry.sync') return syncAthleteBiometry(job.data)
    throw new Error(`Unsupported job type: ${job.name}`)
  }, { connection })

  worker.on('failed', (job, error) => {
    console.error(`Background job ${job?.name} failed:`, error)
    if (job?.name === 'biometry.sync' && job.attemptsMade >= Number(job.opts.attempts ?? 1)) {
      query(
        "UPDATE athletes SET biometry_status = 'rejected', updated_at = now() WHERE id = $1 AND status = 'approved'",
        [job.data.athleteId],
      ).catch((updateError) => console.error('Could not record failed biometric synchronization:', updateError))
    }
  })
  const dispatch = () => enqueueOutboxEvents(jobsQueue).catch((error) => console.error('Outbox dispatch failed:', error))
  await dispatch()
  const timer = setInterval(dispatch, 2_000)
  timer.unref()

  return async () => {
    clearInterval(timer)
    await worker.close()
    await jobsQueue.close()
    await connection.quit()
  }
}
