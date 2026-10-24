import { test, expect } from '@playwright/test'
import { readLastSmsCode, generateTotp, registerTestManager, closeDb } from './helpers.js'

// Mesmas credenciais seedadas pelo backend/src/db/seed-admin.js em desenvolvimento (ver
// compose.yaml, serviço "api") — sobrescrevíveis por variável de ambiente para quem roda a suíte
// com outros valores.
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@lvj.com'
const ADMIN_ORIGINAL_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'Admin123-local-change-me!'
const ADMIN_TOTP_SECRET = process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'

test.afterAll(async () => {
  await closeDb()
})

// Leva a tela de login até o passo "request" do diálogo de recuperação. A página precisa estar
// em "/" e sem nenhum diálogo aberto ainda.
async function openForgotPassword(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar' }).first().click()
  const loginDialog = page.getByRole('dialog')
  await loginDialog.getByRole('button', { name: 'Esqueci minha senha?' }).click()
  return page.getByRole('dialog')
}

// Restaura a senha original do admin pela própria API (sem UI) — roda mesmo se o teste falhar,
// para a conta seedada continuar com a senha conhecida depois da suíte.
async function restoreAdminPassword(request, baseURL) {
  const requestRes = await request.post(`${baseURL}/api/auth/forgot-password/request`, {
    data: { email: ADMIN_EMAIL },
  })
  if (!requestRes.ok()) return
  const verifyRes = await request.post(`${baseURL}/api/auth/forgot-password/verify`, {
    data: { email: ADMIN_EMAIL, totp: generateTotp(ADMIN_TOTP_SECRET) },
  })
  if (!verifyRes.ok()) return
  const { reset_token } = await verifyRes.json()
  await request.post(`${baseURL}/api/auth/forgot-password/reset`, {
    data: { reset_token, password: ADMIN_ORIGINAL_PASSWORD },
  })
}

test.describe('Esqueci minha senha', () => {
  test('caminho feliz — administrador verifica por TOTP e troca a senha', async ({ page, request, baseURL }) => {
    const newPassword = 'senha-e2e-admin-temporaria-01'
    try {
      const dialog = await openForgotPassword(page)
      await dialog.getByLabel('E-mail').fill(ADMIN_EMAIL)
      await dialog.getByRole('button', { name: 'Continuar' }).click()

      // A tela seguinte precisa pedir o autenticador (nunca SMS) para uma conta de administrador.
      await expect(dialog.getByText('Administrador', { exact: true })).toBeVisible()
      await dialog.getByLabel('Código do autenticador').fill(generateTotp(ADMIN_TOTP_SECRET))
      await dialog.getByRole('button', { name: 'Confirmar código' }).click()

      await expect(dialog.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
      await dialog.getByLabel('Nova senha', { exact: true }).fill(newPassword)
      await dialog.getByLabel('Confirmar nova senha').fill(newPassword)
      await dialog.getByRole('button', { name: 'Redefinir senha' }).click()

      await expect(dialog.getByRole('heading', { name: 'Senha redefinida com sucesso' })).toBeVisible()
      await dialog.getByRole('button', { name: 'Voltar para o login' }).click()

      // Login de ponta a ponta com a senha nova, prova real de que a troca funcionou.
      const loginDialog = page.getByRole('dialog')
      await loginDialog.getByLabel('E-mail').fill(ADMIN_EMAIL)
      await loginDialog.getByLabel('Senha').fill(newPassword)
      await loginDialog.getByRole('button', { name: 'Entrar' }).click()
      await expect(loginDialog.getByLabel('Código 2FA do administrador')).toBeVisible()
      await loginDialog.getByLabel('Código 2FA do administrador').fill(generateTotp(ADMIN_TOTP_SECRET))
      await loginDialog.getByRole('button', { name: 'Entrar' }).click()

      await page.waitForURL('**/admin')
    } finally {
      await restoreAdminPassword(request, baseURL)
    }
  })

  test('caminho feliz — gestor/atleta verifica por SMS e troca a senha', async ({ page, request, baseURL }) => {
    const { email, phone } = await registerTestManager(request, baseURL)
    const newPassword = 'senha-e2e-gestor-nova-123456'

    const dialog = await openForgotPassword(page)
    await dialog.getByLabel('E-mail').fill(email)
    await dialog.getByRole('button', { name: 'Continuar' }).click()

    // Conta de gestor/atleta precisa pedir o código por SMS (nunca o autenticador).
    await expect(dialog.getByText('Atleta / Gestor', { exact: true })).toBeVisible()

    const code = await readLastSmsCode(phone)
    await dialog.getByLabel('Código recebido por SMS').fill(code)
    await dialog.getByRole('button', { name: 'Confirmar código' }).click()

    await expect(dialog.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
    await dialog.getByLabel('Nova senha', { exact: true }).fill(newPassword)
    await dialog.getByLabel('Confirmar nova senha').fill(newPassword)
    await dialog.getByRole('button', { name: 'Redefinir senha' }).click()

    await expect(dialog.getByRole('heading', { name: 'Senha redefinida com sucesso' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Voltar para o login' }).click()

    const loginDialog = page.getByRole('dialog')
    await loginDialog.getByLabel('E-mail').fill(email)
    await loginDialog.getByLabel('Senha').fill(newPassword)
    await loginDialog.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('erro — código do autenticador inválido (administrador)', async ({ page }) => {
    const dialog = await openForgotPassword(page)
    await dialog.getByLabel('E-mail').fill(ADMIN_EMAIL)
    await dialog.getByRole('button', { name: 'Continuar' }).click()

    await dialog.getByLabel('Código do autenticador').fill('000000')
    await dialog.getByRole('button', { name: 'Confirmar código' }).click()

    await expect(dialog.getByText('Código de autenticação de dois fatores inválido')).toBeVisible()
    // Continua no mesmo passo — não avança para a troca de senha com um código errado.
    await expect(dialog.getByRole('heading', { name: 'Nova senha' })).not.toBeVisible()
  })

  test('erro — código SMS inválido (atleta/gestor)', async ({ page, request, baseURL }) => {
    const { email } = await registerTestManager(request, baseURL)

    const dialog = await openForgotPassword(page)
    await dialog.getByLabel('E-mail').fill(email)
    await dialog.getByRole('button', { name: 'Continuar' }).click()

    await dialog.getByLabel('Código recebido por SMS').fill('111111')
    await dialog.getByRole('button', { name: 'Confirmar código' }).click()

    await expect(dialog.getByText('Código inválido ou expirado')).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Nova senha' })).not.toBeVisible()
  })

  test('erro — bloqueio por excesso de tentativas de verificação (rate limit)', async ({ page }) => {
    // O rate limit em si é testado no backend (express-rate-limit); aqui o que importa pro E2E é
    // a reação da tela a um 429 — por isso a resposta é interceptada, sem gastar tentativas reais
    // do limitador (backend/src/security/rate-limit.js: forgotPasswordVerifyRateLimit, 5/15min por
    // e-mail) e sem depender de uma janela de 15 minutos limpa para a suíte rodar de novo.
    await page.route('**/api/auth/forgot-password/request', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, method: 'sms' }),
    }))
    await page.route('**/api/auth/forgot-password/verify', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Muitas tentativas de verificação. Tente novamente mais tarde.' }),
    }))

    const dialog = await openForgotPassword(page)
    await dialog.getByLabel('E-mail').fill('qualquer-conta@lvj.test')
    await dialog.getByRole('button', { name: 'Continuar' }).click()

    await dialog.getByLabel('Código recebido por SMS').fill('123456')
    await dialog.getByRole('button', { name: 'Confirmar código' }).click()

    await expect(dialog.getByText('Muitas tentativas de verificação. Tente novamente mais tarde.')).toBeVisible()
  })

  test('erro — confirmação de nova senha não coincide com a senha', async ({ page, request, baseURL }) => {
    const { email, phone } = await registerTestManager(request, baseURL)

    const dialog = await openForgotPassword(page)
    await dialog.getByLabel('E-mail').fill(email)
    await dialog.getByRole('button', { name: 'Continuar' }).click()

    const code = await readLastSmsCode(phone)
    await dialog.getByLabel('Código recebido por SMS').fill(code)
    await dialog.getByRole('button', { name: 'Confirmar código' }).click()

    await expect(dialog.getByRole('heading', { name: 'Nova senha' })).toBeVisible()
    await dialog.getByLabel('Nova senha', { exact: true }).fill('senha-correta-123456')
    await dialog.getByLabel('Confirmar nova senha').fill('senha-diferente-654321')

    await expect(dialog.getByText('As senhas não coincidem.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled()
  })
})
