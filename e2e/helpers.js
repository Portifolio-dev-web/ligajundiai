import pg from 'pg'
import { authenticator } from 'otplib'

const { Pool } = pg

// Mesmo banco do docker-compose local (backend/compose.yaml, serviço "postgres") — a suíte roda
// contra o stack de desenvolvimento já no ar, não um banco de teste isolado. Ver playwright.config.js.
const DATABASE_URL = process.env.PLAYWRIGHT_DATABASE_URL
  || 'postgresql://liga:liga_local_only@localhost:5432/ligajundiai'

let pool
function db() {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL })
  return pool
}

export async function closeDb() {
  if (pool) await pool.end()
}

// O "envio" de SMS é mockado em backend/src/services/sms.js — nenhuma operadora real é chamada,
// a mensagem só é gravada em sms_outbox (e logada no console da API). Esta função é o equivalente
// a ler a caixa de entrada de um Mailpit, só que para o mock de SMS: lê o corpo da última mensagem
// enviada para o telefone e extrai o código de 6 dígitos.
export async function readLastSmsCode(phone) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await db().query(
      'SELECT body FROM sms_outbox WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [phone],
    )
    const match = result.rows[0]?.body?.match(/\d{6}/)
    if (match) return match[0]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Nenhum SMS mock encontrado para o telefone ${phone}`)
}

export function generateTotp(secret) {
  return authenticator.generate(secret)
}

export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lvj.test`
}

export function uniquePhone() {
  return `119${Date.now().toString().slice(-8)}`
}

// Cria uma conta de gestor descartável direto pela API (mesma rota que o formulário de cadastro
// usa) — cada teste recebe e-mail/telefone únicos para que o rate limit por conta
// (backend/src/security/rate-limit.js) nunca vaze de um cenário para o outro.
export async function registerTestManager(request, baseURL, { phone } = {}) {
  const email = uniqueEmail('gestor-e2e')
  const password = 'senha-e2e-inicial-123456'
  const resolvedPhone = phone || uniquePhone()
  const response = await request.post(`${baseURL}/api/auth/register`, {
    data: { name: 'Gestor E2E', email, password, phone: resolvedPhone, consent: true },
  })
  if (!response.ok()) {
    throw new Error(`Falha ao registrar usuário de teste: HTTP ${response.status()} ${await response.text()}`)
  }
  return { email, password, phone: resolvedPhone }
}
