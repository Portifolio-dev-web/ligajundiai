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

// SEGURANÇA (varredura, item S1): "adminPreviewHtml" é o que o painel do admin mostra em
// GET /admin/emails; "html" é o que de fato é enviado por SMTP e nunca é exposto pela API.
// Por padrão os dois são iguais (mensagens sem segredo, como aprovação de equipe/atleta).
// Chamadas que enviam um segredo de uso único (ex.: código de login por e-mail) devem passar
// um adminPreviewHtml próprio, com o segredo oculto — ver auth.js, rota /otp/request.
export async function enqueueEmail(client, { to, subject, html, adminPreviewHtml, eventId }) {
  const inserted = await client.query(
    `INSERT INTO email_outbox (event_id, recipient, subject, html, admin_preview_html)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [eventId, to, subject, html, adminPreviewHtml ?? html],
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
