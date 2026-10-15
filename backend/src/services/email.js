import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { query, transaction } from '../db/pool.js'

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: false,
  ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
})

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export async function enqueueEmail(client, { to, subject, html, eventId }) {
  const inserted = await client.query(
    `INSERT INTO email_outbox (event_id, recipient, subject, html)
     VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [eventId, to, subject, html],
  )
  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO outbox_events (event_key, event_type, payload)
       VALUES ($1, 'email.send', $2::jsonb) ON CONFLICT (event_key) DO NOTHING`,
      [eventId, JSON.stringify({ emailId: inserted.rows[0].id })],
    )
  }
}

export async function sendQueuedEmail(emailId) {
  const result = await query(
    'SELECT id, recipient, subject, html FROM email_outbox WHERE id = $1 AND sent_at IS NULL',
    [emailId],
  )
  const email = result.rows[0]
  if (!email) return
  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: email.recipient,
      subject: email.subject,
      html: email.html,
    })
    await query('UPDATE email_outbox SET sent_at = now(), last_error = NULL WHERE id = $1', [email.id])
  } catch (error) {
    await query(
      'UPDATE email_outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1',
      [email.id, String(error.message).slice(0, 500)],
    )
    throw error
  }
}

export async function enqueueOutboxEvents(queue, batchSize = 25) {
  await transaction(async (client) => {
    const events = await client.query(
      `SELECT id, event_key, event_type, payload FROM outbox_events
       WHERE published_at IS NULL ORDER BY created_at
       FOR UPDATE SKIP LOCKED LIMIT $1`,
      [batchSize],
    )
    for (const event of events.rows) {
      await queue.add(event.event_type, event.payload, { jobId: event.id, attempts: 8, backoff: { type: 'exponential', delay: 1000 } })
      await client.query('UPDATE outbox_events SET published_at = now() WHERE id = $1', [event.id])
    }
  })
}
