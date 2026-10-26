import { request as basePlaywrightRequest } from '@playwright/test'
import { createHmac } from 'node:crypto'
import pg from 'pg'
import { authenticator } from 'otplib'

const { Pool } = pg

// Mesmo banco do docker-compose local (compose.yaml, serviço "postgres") — a suíte roda contra o
// stack de desenvolvimento já no ar, não um banco de teste isolado. Ver playwright.config.js.
const DATABASE_URL = process.env.PLAYWRIGHT_DATABASE_URL
  || 'postgresql://liga:liga_local_only@localhost:5432/ligajundiai'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@lvj.com'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'Admin123-local-change-me!'
const ADMIN_TOTP_SECRET = process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'
const WEBHOOK_SECRET = process.env.PLAYWRIGHT_WEBHOOK_SECRET || 'development-only-turnstile-webhook-secret-32-bytes'

// As 6 categorias seedadas em backend/sql/schema.sql — únicas aceitas por assertValidCategory.
export const CATEGORIES = [
  'Adulto Masculino', 'Adulto Feminino', 'Master Masculino',
  'Master Feminino', 'Sub-19 Masculino', 'Sub-19 Feminino',
]

// Módulo compartilhado entre todos os arquivos .spec.js (mesmo processo, workers:1) — cada arquivo
// chama closeDb() no próprio afterAll, então "pool" precisa voltar a null depois de fechado, senão
// o próximo arquivo herda um Pool já finalizado (toda query subsequente falharia).
let pool
function db() {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL })
  return pool
}

export async function closeDb() {
  if (!pool) return
  const current = pool
  pool = null
  await current.end()
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

let emailCounter = 0
export function uniqueEmail(prefix) {
  emailCounter += 1
  return `${prefix}-${Date.now()}-${emailCounter}-${Math.random().toString(36).slice(2, 8)}@lvj.test`
}

export function uniquePhone() {
  return `119${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`
}

// RG só precisa de 5 a 9 dígitos (ver backend/src/security/validation.js, isValidRg) — único por
// usuário (users.rg_hash tem índice único), então cada fixture usa um valor próprio.
export function uniqueRg() {
  return String(Math.floor(10000000 + Math.random() * 89999999))
}

function isoIn(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString()
}

async function expectOk(response, label) {
  if (!response.ok()) {
    throw new Error(`${label}: HTTP ${response.status()} ${await response.text()}`)
  }
  return response.json()
}

// Cria uma conta de gestor descartável direto pela API (mesma rota que o formulário de cadastro
// usa) — cada teste recebe e-mail/telefone únicos para que o rate limit por conta
// (backend/src/security/rate-limit.js) nunca vaze de um cenário para o outro. A sessão fica
// gravada no cookie jar do `request` recebido (reaproveite um contexto por ator).
export async function registerTestManager(request, baseURL, { phone } = {}) {
  const email = uniqueEmail('gestor-e2e')
  const password = 'senha-e2e-inicial-123456'
  const resolvedPhone = phone || uniquePhone()
  const response = await request.post(`${baseURL}/api/auth/register`, {
    data: { name: 'Gestor E2E', email, password, phone: resolvedPhone, consent: true },
  })
  const { user } = await expectOk(response, 'registerTestManager')
  return { email, password, phone: resolvedPhone, userId: user.id }
}

// Autentica a PRÓPRIA página (não um contexto de API separado) — a sessão fica no cookie jar do
// browser, então a navegação seguinte (page.goto) já carrega logada. Só aceita email/password de
// propósito (login-password é .strict() no backend e rejeita campos extras como "phone"/"userId",
// que os objetos de conta devolvidos por registerTestManager/criarXxx carregam para outros fins).
export async function loginPageAs(page, { email, password, totp } = {}) {
  const response = await page.request.post('/api/auth/login-password', {
    data: { email, password, ...(totp ? { totp } : {}) },
  })
  if (!response.ok()) {
    throw new Error(`loginPageAs(${email}) falhou: HTTP ${response.status()} ${await response.text()}`)
  }
}

export async function loginPageAsAdmin(page) {
  return loginPageAs(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, totp: generateTotp(ADMIN_TOTP_SECRET) })
}

// Um contexto de API isolado (cookie jar próprio) autenticado como o admin seedado. QUEM CHAMA
// precisa `.dispose()` o contexto quando terminar.
export async function loginAsAdmin(baseURL) {
  const ctx = await basePlaywrightRequest.newContext({ baseURL })
  const response = await ctx.post(`${baseURL}/api/auth/login-password`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, totp: generateTotp(ADMIN_TOTP_SECRET) },
  })
  await expectOk(response, 'loginAsAdmin')
  return ctx
}

// Idem, mas para um gestor já registrado (registerTestManager) — contexto próprio, independente
// do `request` usado para registrar, útil quando o teste de UI usa `page` para uma coisa e precisa
// de uma sessão de API separada para preparar fixtures de outro ator ao mesmo tempo.
export async function loginAsManager(baseURL, { email, password }) {
  const ctx = await basePlaywrightRequest.newContext({ baseURL })
  const response = await ctx.post(`${baseURL}/api/auth/login-password`, {
    data: { email, password },
  })
  await expectOk(response, 'loginAsManager')
  return ctx
}

// Abre (ou estende) uma janela de inscrição bem larga para a categoria+tipo — sem isso, toda
// criação de equipe (POST /api/teams) ou autocadastro de atleta (POST /api/athletes/self-register)
// cai em 403 TEAM_REGISTRATION_CLOSED/ATHLETE_REGISTRATION_CLOSED. Idempotente (ON CONFLICT),
// então é seguro chamar em todo teste que precisa dela, mesmo repetido.
export async function openRegistrationPeriod(adminCtx, baseURL, category, type) {
  const response = await adminCtx.put(
    `${baseURL}/api/admin/registration-periods/${encodeURIComponent(category)}/${type}`,
    { data: { starts_at: isoIn(-60 * 60 * 1000), ends_at: isoIn(365 * 24 * 60 * 60 * 1000) } },
  )
  await expectOk(response, `openRegistrationPeriod(${category}, ${type})`)
}

// Fixture completa: registra um gestor, abre a inscrição de equipes para a categoria, cria a
// equipe e a aprova como admin. Devolve tudo que os testes de UI precisam para logar como esse
// gestor pela tela (email/password) e referenciar a equipe (team).
export async function createApprovedTeam(request, baseURL, adminCtx, { category = CATEGORIES[0], name } = {}) {
  const manager = await registerTestManager(request, baseURL)
  // createAthlete() (chamada tanto pelo cadastro do gestor quanto pelo autocadastro público)
  // também exige o período de ATLETA aberto, não só o de equipe — abrir os dois aqui evita que
  // qualquer fixture de atleta construída sobre esta equipe precise reabrir a janela depois.
  await openRegistrationPeriod(adminCtx, baseURL, category, 'team')
  await openRegistrationPeriod(adminCtx, baseURL, category, 'athlete')
  const managerCtx = await loginAsManager(baseURL, manager)
  const teamResponse = await managerCtx.post(`${baseURL}/api/teams`, {
    data: { name: name || `Equipe E2E ${Date.now()}`, category, consent: true },
  })
  const { team } = await expectOk(teamResponse, 'createApprovedTeam: POST /api/teams')
  const approveResponse = await adminCtx.post(`${baseURL}/api/admin/teams/${team.id}/approve`, { data: {} })
  const { team: approvedTeam } = await expectOk(approveResponse, 'createApprovedTeam: approve')
  return { manager, managerCtx, team: approvedTeam }
}

// Cadastra um atleta pelo gestor (sem foto biométrica — createAthlete só exige o consentimento
// biométrico quando biometry_key vem preenchido) e devolve o registro em status "awaiting_manager".
export async function createAthleteAsManager(managerCtx, baseURL, teamId, { name = 'Atleta E2E' } = {}) {
  const response = await managerCtx.post(`${baseURL}/api/athletes`, {
    data: { team_id: teamId, name, rg: uniqueRg(), positions: ['ponteiro'], consent: true },
  })
  const { athlete } = await expectOk(response, 'createAthleteAsManager')
  return athlete
}

export async function approveAthleteAsManager(managerCtx, baseURL, athleteId) {
  const response = await managerCtx.post(`${baseURL}/api/gestor/athletes/${athleteId}/approve`, { data: {} })
  return (await expectOk(response, 'approveAthleteAsManager')).athlete
}

export async function approveAthleteAsAdmin(adminCtx, baseURL, athleteId) {
  const response = await adminCtx.post(`${baseURL}/api/admin/athletes/${athleteId}/approve`, { data: {} })
  return (await expectOk(response, 'approveAthleteAsAdmin')).athlete
}

// Cadeia completa: equipe aprovada + atleta aprovado pelo gestor E pelo admin (status "approved").
// É a fixture mais cara da suíte (Atletas/Presença/Jogos do admin dependem dela) — construída uma
// vez e reaproveitada, nunca repetida tela a tela.
export async function createFullyApprovedAthlete(request, baseURL, adminCtx, opts = {}) {
  const { managerCtx, team } = await createApprovedTeam(request, baseURL, adminCtx, opts)
  const athlete = await createAthleteAsManager(managerCtx, baseURL, team.id, opts)
  await approveAthleteAsManager(managerCtx, baseURL, athlete.id)
  const approved = await approveAthleteAsAdmin(adminCtx, baseURL, athlete.id)
  return { managerCtx, team, athlete: approved }
}

export async function createMatch(adminCtx, baseURL, homeTeamId, awayTeamId, extra = {}) {
  const response = await adminCtx.post(`${baseURL}/api/admin/matches`, {
    data: { home_team_id: homeTeamId, away_team_id: awayTeamId, ...extra },
  })
  return (await expectOk(response, 'createMatch')).match
}

export async function acceptMatch(managerCtx, baseURL, matchId) {
  const response = await managerCtx.post(`${baseURL}/api/gestor/matches/${matchId}/accept`, { data: {} })
  return (await expectOk(response, 'acceptMatch')).match
}

export async function setMatchResult(adminCtx, baseURL, matchId, sets) {
  const response = await adminCtx.put(`${baseURL}/api/admin/matches/${matchId}/result`, { data: { sets } })
  return (await expectOk(response, 'setMatchResult')).match
}

// POST /api/admin/attendance (presença "manual") NUNCA grava match_id (ver backend/src/routes/
// admin.js) — só conta para o percentual de frequência, não aparece ligada a um jogo específico
// no /atleta/jogos. A ÚNICA forma real de presença amarrada a um jogo é o webhook da catraca
// (backend/src/routes/webhooks.js, POST /api/webhooks/turnstile), que exige HMAC válido e um
// atleta com biometria "synced" — daí os dois helpers abaixo.
export async function markAthleteBiometrySynced(athleteId, controlIdReference) {
  await db().query(
    "UPDATE athletes SET control_id_reference = $2, biometry_status = 'synced' WHERE id = $1",
    [athleteId, controlIdReference],
  )
}

export async function simulateTurnstileCheckIn(request, baseURL, { matchId, controlIdReference, occurredAt }) {
  const body = JSON.stringify({
    event_id: `e2e-turnstile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    match_id: matchId,
    control_id_reference: controlIdReference,
    occurred_at: occurredAt || new Date().toISOString(),
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(`${timestamp}.`).update(body).digest('hex')
  const response = await request.post(`${baseURL}/api/webhooks/turnstile`, {
    data: body,
    headers: { 'content-type': 'application/json', 'x-lvj-timestamp': String(timestamp), 'x-lvj-signature': signature },
  })
  return expectOk(response, 'simulateTurnstileCheckIn')
}

// Promove uma conta recém-registrada (sempre role=gestor via /api/auth/register) a atleta direto
// no banco — suficiente para testar o CONTROLE DE ACESSO e o carregamento de /atleta/*, sem andar
// pela cadeia pesada de equipe aprovada + cadastro biométrico + duas aprovações, que só é
// necessária para testar a FUNCIONALIDADE de frequência/declaração em si (essa usa
// createFullyApprovedAthlete + um `users.id` promovido do mesmo jeito, ligado por athletes.user_id).
export async function promoteUserToAtleta(userId) {
  await db().query("UPDATE users SET role = 'atleta' WHERE id = $1", [userId])
}

export async function linkAthleteToUser(athleteId, userId) {
  await db().query('UPDATE athletes SET user_id = $1 WHERE id = $2', [userId, athleteId])
}

// PERFORMANCE: acumula o Cumulative Layout Shift real da página via a mesma Layout Instability
// API que o Chrome usa para o Web Vitals — chame ANTES de page.goto() (precisa estar registrado
// antes do primeiro paint) e leia o valor com readLayoutShift() depois que o conteúdo final já
// estiver na tela. 0,1 é o limite oficial do Google para "bom" (web.dev/cls); os testes que usam
// isso cobrem telas que trocam um spinner de uma linha por conteúdo bem mais alto (gestor/atleta)
// — sem altura reservada, esse salto sozinho já estoura 0,1 com folga.
export async function observeLayoutShift(page) {
  await page.addInitScript(() => {
    window.__cls = 0
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {}
  })
}

export async function readLayoutShift(page) {
  return page.evaluate(() => window.__cls ?? 0)
}
