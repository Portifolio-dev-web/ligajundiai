import { test, expect } from '@playwright/test'
import { loginPageAsAdmin, generateTotp } from './helpers.js'

const ADMIN_TOTP_SECRET = process.env.PLAYWRIGHT_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'

// IMPORTANTE: esta suíte nunca chama "Confirmar e ativar" — isso promoveria um segredo TOTP novo
// (gerado pelo próprio servidor, imprevisível) a ativo, e TODO outro arquivo da suíte loga como
// este mesmo admin usando ADMIN_TOTP_SECRET fixo (env/helpers.js). Confirmar uma rotação aqui
// quebraria o login do admin em todos os outros specs pelo resto da execução. Testa o caminho de
// erro (código atual inválido) e o de sucesso parcial + cancelamento, nunca a ativação.
test.describe('/admin — aba Segurança', () => {
  test('código 2FA atual inválido é rejeitado', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Segurança' }).click()

    await page.getByLabel('Código 2FA atual').fill('000000')
    await page.getByRole('button', { name: 'Gerar novo segredo 2FA' }).click()
    await expect(page.getByText('Código de autenticação de dois fatores atual inválido')).toBeVisible()
  })

  test('código atual válido gera um segredo pendente, que pode ser cancelado sem ativar', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Segurança' }).click()

    await page.getByLabel('Código 2FA atual').fill(generateTotp(ADMIN_TOTP_SECRET))
    await page.getByRole('button', { name: 'Gerar novo segredo 2FA' }).click()

    await expect(page.getByText('Adicione este segredo ao seu aplicativo autenticador')).toBeVisible()
    await expect(page.getByLabel('Código gerado pelo segredo novo')).toBeVisible()

    // Cancela em vez de confirmar — o segredo ativo da conta nunca muda (ver aviso no topo do arquivo).
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByLabel('Código 2FA atual')).toBeVisible()
    await expect(page.getByText('Adicione este segredo ao seu aplicativo autenticador')).not.toBeVisible()
  })
})
