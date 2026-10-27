import { test, expect } from '@playwright/test'
import {
  registerTestManager, promoteUserToAtleta, generateTotp, closeDb,
} from './helpers.js'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@lvj.com'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'Admin123-local-change-me!'
const ADMIN_TOTP_SECRET = process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'

let gestorAccount
let atletaAccount

test.beforeAll(async ({ request, baseURL }) => {
  gestorAccount = await registerTestManager(request, baseURL)
  const athleteUser = await registerTestManager(request, baseURL)
  await promoteUserToAtleta(athleteUser.userId)
  atletaAccount = { email: athleteUser.email, password: athleteUser.password }
})

test.afterAll(async () => {
  await closeDb()
})

// Autentica a própria página (não um contexto de API separado) — a sessão fica no cookie jar do
// browser, então a navegação seguinte já carrega logada. Mesma rota que o LoginDialog usa.
async function loginPageAs(page, role) {
  const data = role === 'admin'
    ? { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, totp: generateTotp(ADMIN_TOTP_SECRET) }
    : role === 'gestor'
      ? { email: gestorAccount.email, password: gestorAccount.password }
      : { email: atletaAccount.email, password: atletaAccount.password }
  const response = await page.request.post('/api/auth/login-password', { data })
  if (!response.ok()) {
    throw new Error(`loginPageAs(${role}) falhou: HTTP ${response.status()} ${await response.text()}`)
  }
}

test.describe('Controle de acesso (middleware.js)', () => {
  const privateRoutes = [
    { path: '/admin', role: 'admin', ownHome: '/admin' },
    { path: '/gestor', role: 'gestor', ownHome: '/gestor' },
    { path: '/gestor/aprovar-atletas', role: 'gestor', ownHome: '/gestor' },
    { path: '/atleta', role: 'atleta', ownHome: '/atleta' },
    { path: '/atleta/jogos', role: 'atleta', ownHome: '/atleta' },
  ]

  for (const route of privateRoutes) {
    test(`${route.path} — visitante não autenticado é redirecionado para o login`, async ({ page }) => {
      await page.goto(route.path)
      await expect(page).toHaveURL(new RegExp(`/\\?next=${encodeURIComponent(route.path).replace(/[/]/g, '%2F')}`))
    })
  }

  test('/jogos — visitante não autenticado é redirecionado para o login', async ({ page }) => {
    await page.goto('/jogos')
    await expect(page).toHaveURL(/\/\?next=%2Fjogos/)
  })

  test('/admin — gestor é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'gestor')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/gestor$/)
  })

  test('/admin — atleta é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'atleta')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/atleta(\/jogos)?$/)
  })

  test('/gestor — atleta é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'atleta')
    await page.goto('/gestor')
    await expect(page).toHaveURL(/\/atleta(\/jogos)?$/)
  })

  test('/gestor — admin é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'admin')
    await page.goto('/gestor')
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('/atleta — gestor é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'gestor')
    await page.goto('/atleta')
    await expect(page).toHaveURL(/\/gestor$/)
  })

  test('/admin — admin autenticado acessa e vê o painel', async ({ page }) => {
    await loginPageAs(page, 'admin')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Painel Administrativo' })).toBeVisible()
  })

  test('/gestor — gestor autenticado acessa e vê o painel', async ({ page }) => {
    await loginPageAs(page, 'gestor')
    await page.goto('/gestor')
    await expect(page).toHaveURL(/\/gestor$/)
    await expect(page.getByRole('heading', { name: 'Painel do gestor' })).toBeVisible()
  })

  test('/atleta — atleta autenticado acessa (redireciona para /atleta/jogos) e vê o painel', async ({ page }) => {
    await loginPageAs(page, 'atleta')
    await page.goto('/atleta')
    await expect(page).toHaveURL(/\/atleta\/jogos$/)
    await expect(page.getByRole('heading', { name: 'Painel do Atleta' })).toBeVisible()
  })

  // PERFORMANCE/UX (redesign do painel do gestor, aprovado por mockup): /jogos e /gestor/jogos
  // agora só redirecionam (ver app/jogos/page.jsx e app/gestor/jogos/page.jsx) — a função das duas
  // rotas migrou para a aba "Agenda" dentro do Painel do Gestor.
  test('/jogos — gestor autenticado é redirecionado para o próprio painel', async ({ page }) => {
    await loginPageAs(page, 'gestor')
    await page.goto('/jogos')
    // /jogos redireciona para /atleta/jogos; como quem chegou é um gestor (papel errado para
    // /atleta/jogos), o middleware.js intercepta e manda de volta para a própria home do gestor.
    await expect(page).toHaveURL(/\/gestor$/)
  })

  test('/jogos — atleta autenticado é redirecionado para /atleta/jogos', async ({ page }) => {
    await loginPageAs(page, 'atleta')
    await page.goto('/jogos')
    await expect(page).toHaveURL(/\/atleta\/jogos$/)
    await expect(page.getByRole('heading', { name: 'Painel do Atleta' })).toBeVisible()
  })

  test('/gestor/jogos — rota antiga redireciona para o painel (aba Agenda)', async ({ page }) => {
    await loginPageAs(page, 'gestor')
    await page.goto('/gestor/jogos')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Painel do Gestor' })).toBeVisible()
  })

  test('/ — admin autenticado é redirecionado automaticamente para /admin', async ({ page }) => {
    await loginPageAs(page, 'admin')
    await page.goto('/')
    await expect(page).toHaveURL(/\/admin$/)
  })
})
