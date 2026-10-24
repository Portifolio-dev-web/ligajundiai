import { query } from '../db/pool.js'

// Mock: nenhuma operadora/provedor real é chamado — a mensagem só é registrada em sms_outbox e
// logada no console, mesmo papel que o Mailpit local faz para e-mail em desenvolvimento. Trocar
// por um provedor de verdade (Twilio, Zenvia etc.) é só reescrever o corpo de sendQueuedSms.
export async function enqueueSms(client, { to, body, adminPreviewBody, eventId }) {
  const inserted = await client.query(
    `INSERT INTO sms_outbox (event_id, phone, body, admin_preview_body)
     VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [eventId, to, body, adminPreviewBody ?? body],
  )
  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO outbox_events (event_key, event_type, payload)
       VALUES ($1, 'sms.send', $2::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [eventId, JSON.stringify({ smsId: inserted.rows[0].id })],
    )
  }
}

export async function sendQueuedSms(smsId) {
  const result = await query(
    'SELECT id, phone, body FROM sms_outbox WHERE id = $1 AND sent_at IS NULL',
    [smsId],
  )
  const sms = result.rows[0]
  if (!sms) return
  console.info(`[SMS mock] para ${sms.phone}: ${sms.body}`)
  await query('UPDATE sms_outbox SET sent_at = now(), last_error = NULL WHERE id = $1', [sms.id])
}
