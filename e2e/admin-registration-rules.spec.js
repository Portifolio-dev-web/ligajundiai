import { test, expect } from '@playwright/test'
import { loginPageAsAdmin, loginAsAdmin, CATEGORIES, closeDb } from './helpers.js'

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

function isoLocal(offsetMs) {
  const date = new Date(Date.now() + offsetMs)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

test.describe('/admin — aba Inscrições', () => {
  test('abre e depois fecha o período de inscrição de uma categoria', async ({ page, baseURL }) => {
    const category = CATEGORIES[1]
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Inscrições' }).click()

    await page.locator('#registration-category').click()
    await page.getByRole('option', { name: category, exact: true }).click()
    await page.getByRole('tab', { name: 'Cadastro de atletas' }).click()

    await page.locator('#registration-start').fill(isoLocal(-60 * 60 * 1000))
    await page.locator('#registration-end').fill(isoLocal(365 * 24 * 60 * 60 * 1000))
    await page.getByRole('button', { name: 'Salvar período' }).click()

    await expect(page.getByText('Atualização concluída', { exact: true })).toBeVisible()
    await expect(page.getByText(`Período de cadastro de atletas salvo para ${category}.`)).toBeVisible()
    await expect(page.getByText('Inscrições abertas', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Remover e fechar inscrições' }).click()
    await expect(page.getByText('Período removido. As inscrições ficarão fechadas até uma nova configuração.')).toBeVisible()
    await expect(page.getByText('Fechado · sem período configurado').first()).toBeVisible()

    // Devolve a janela ampla de teste — outras fixtures da suíte dependem dela estar aberta.
    const response = await adminCtx.put(`${baseURL}/api/admin/registration-periods/${encodeURIComponent(category)}/athlete`, {
      data: { starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
    })
    expect(response.ok()).toBe(true)
  })

  test('data final antes da inicial é rejeitada', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Inscrições' }).click()

    await page.locator('#registration-start').fill(isoLocal(24 * 60 * 60 * 1000))
    await page.locator('#registration-end').fill(isoLocal(0))
    await page.getByRole('button', { name: 'Salvar período' }).click()
    await expect(page.getByText('A data final deve ser posterior à data inicial.')).toBeVisible()
  })
})

test.describe('/admin — aba Regulamento', () => {
  test('ajusta a pontuação e a presença mínima, salva e restaura os valores originais', async ({ page, baseURL }) => {
    const before = await (await adminCtx.get(`${baseURL}/api/rules`)).json()

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Regulamento' }).click()

    await expect(page.getByText('Motor de Regras Configuráveis', { exact: true })).toBeVisible()
    await page.locator('#rules-point-win_3_0').fill('5')
    await page.getByLabel('Presença mínima para finais/mata-mata').fill('80')
    await page.getByRole('button', { name: 'Salvar Regulamento' }).click()
    await expect(page.getByText('Regulamento salvo! A classificação será recalculada.')).toBeVisible()

    await page.reload()
    await page.getByRole('tab', { name: 'Regulamento' }).click()
    await expect(page.locator('#rules-point-win_3_0')).toHaveValue('5')
    await expect(page.getByLabel('Presença mínima para finais/mata-mata')).toHaveValue('80.00')

    const restore = await adminCtx.put(`${baseURL}/api/rules`, { data: before.rules })
    expect(restore.ok()).toBe(true)
  })

  test('reordena os critérios de desempate', async ({ page, baseURL }) => {
    const before = await (await adminCtx.get(`${baseURL}/api/rules`)).json()
    try {
      await loginPageAsAdmin(page)
      await page.goto('/admin')
      await page.getByRole('tab', { name: 'Regulamento' }).click()

      const firstRow = page.locator('div.rounded-lg').filter({ hasText: 'Pontos' }).first()
      await expect(firstRow.getByRole('button', { name: '↑' })).toBeDisabled()
      await firstRow.getByRole('button', { name: '↓' }).click()
      await page.getByRole('button', { name: 'Salvar Regulamento' }).click()
      await expect(page.getByText('Regulamento salvo! A classificação será recalculada.')).toBeVisible()
    } finally {
      await adminCtx.put(`${baseURL}/api/rules`, { data: before.rules })
    }
  })
})

test.describe('/admin — aba Classificação', () => {
  test('troca de categoria e mantém a tabela visível', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Classificação' }).click()

    await expect(page.getByText('Classificação (automática)', { exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Equipe' })).toBeVisible()

    await page.getByRole('tabpanel', { name: 'Classificação' }).getByRole('combobox').click()
    await page.getByRole('option', { name: CATEGORIES[4], exact: true }).click()
    await expect(page.getByRole('tabpanel', { name: 'Classificação' }).getByRole('combobox')).toHaveText(CATEGORIES[4])
  })
})
