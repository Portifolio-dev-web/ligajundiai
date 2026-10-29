import IORedis from 'ioredis'
import { Queue, Worker } from 'bullmq'
import { config } from '../config.js'
import { query } from '../db/pool.js'
import { sendQueuedEmail, enqueueOutboxEvents } from './email.js'
import { sendQueuedSms } from './sms.js'
import { createBiometryReadUrl, readBiometry } from './storage.js'
import { sweepExpiredRetention } from './retention.js'

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
    if (job.name === 'sms.send') return sendQueuedSms(job.data.smsId)
    if (job.name === 'biometry.sync') return syncAthleteBiometry(job.data)
    if (job.name === 'retention.sweep') return sweepExpiredRetention()
    throw new Error(`Unsupported job type: ${job.name}`)
  }, { connection })

  worker.on('failed', (job, error) => {
    console.error(`Background job ${job?.name} failed:`, error)
    // SEGURANÇA (varredura, item 9): antes só marcava biometry_status = 'rejected' e deixava o
    // atleta com status 'approved' — ou seja, elegível para jogar sem o cadastro biométrico que a
    // aprovação deveria garantir. Agora o status volta para revisão do admin.
    if (job?.name === 'biometry.sync' && job.attemptsMade >= Number(job.opts.attempts ?? 1)) {
      query(
        `UPDATE athletes SET biometry_status = 'rejected', status = 'awaiting_admin', updated_at = now()
         WHERE id = $1 AND status = 'approved' RETURNING manager_user_id, name`,
        [job.data.athleteId],
      ).then(async (result) => {
        const athlete = result.rows[0]
        if (!athlete) return
        const title = 'Biometria não sincronizada'
        const body = `A sincronização biométrica de ${athlete.name} falhou e o cadastro voltou para análise do administrador.`
        await query(
          'INSERT INTO notifications (target, type, title, body) VALUES ($1, $3, $4, $5), ($2, $3, $4, $5)',
          [athlete.manager_user_id, 'admin', 'athlete_biometry_sync_failed', title, body],
        )
      }).catch((updateError) => console.error('Could not record failed biometric synchronization:', updateError))
    }
  })
  const dispatch = () => enqueueOutboxEvents(jobsQueue).catch((error) => console.error('Outbox dispatch failed:', error))
  await dispatch()
  const timer = setInterval(dispatch, 2_000)
  timer.unref()
  // LGPD (varredura, item L9): repetível com jobId fixo — BullMQ não duplica o agendamento a cada
  // reinício da API, só garante que ele exista. Roda uma vez por dia; sweepExpiredRetention() decide
  // se há algo a anonimizar.
  await jobsQueue.add('retention.sweep', {}, {
    repeat: { every: 24 * 60 * 60 * 1000 },
    jobId: 'retention-sweep',
  })

  return async () => {
    clearInterval(timer)
    await worker.close()
    await jobsQueue.close()
    await connection.quit()
  }
}
