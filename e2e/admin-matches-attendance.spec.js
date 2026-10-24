import { test, expect } from '@playwright/test'
import {
  loginPageAsAdmin, loginAsAdmin, createApprovedTeam, createFullyApprovedAthlete,
  acceptMatch, CATEGORIES, closeDb,
} from './helpers.js'

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

test.describe('/admin — aba Jogos & Resultados', () => {
  test('agenda um jogo entre duas equipes aprovadas e lança o resultado', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[0]
    const { managerCtx: homeCtx, team: home } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { managerCtx: awayCtx, team: away } = await createApprovedTeam(request, baseURL, adminCtx, { category })

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Jogos & Resultados' }).click()

    await page.locator('#admin-matches-home').click()
    await page.getByRole('option', { name: home.name, exact: true }).click()
    await page.locator('#admin-matches-away').click()
    await page.getByRole('option', { name: away.name, exact: true }).click()
    const tomorrowLocal = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    await page.locator('#admin-matches-datetime').fill(tomorrowLocal)
    await page.getByRole('button', { name: 'Agendar' }).click()
    await expect(page.getByText('Jogo agendado')).toBeVisible()

    const row = page.locator('div.rounded-lg', { has: page.getByText(home.name) }).filter({ hasText: away.name })
    await expect(row.getByRole('button', { name: 'Placar' })).toBeDisabled()

    // Confirmado só depois que os dois lados aceitam — feito pela API para não duplicar o teste
    // já escrito de /gestor/jogos.
    const matchesResponse = await adminCtx.get(`${baseURL}/api/matches?category=${encodeURIComponent(category)}`)
    const { matches } = await matchesResponse.json()
    const match = matches.find((m) => m.home_name === home.name && m.away_name === away.name)
    await acceptMatch(homeCtx, baseURL, match.id)
    await acceptMatch(awayCtx, baseURL, match.id)

    await page.reload()
    await page.getByRole('tab', { name: 'Jogos & Resultados' }).click()
    const confirmedRow = page.locator('div.rounded-lg', { has: page.getByText(home.name) }).filter({ hasText: away.name })
    await expect(confirmedRow.getByRole('button', { name: 'Placar' })).toBeEnabled()
    await confirmedRow.getByRole('button', { name: 'Placar' }).click()

    const dialog = page.getByRole('dialog', { name: 'Placar por set' })
    for (const [index, set] of [[25, 20], [25, 18], [25, 22]].entries()) {
      const setRow = dialog.getByText(`Set ${index + 1}`, { exact: true }).locator('..')
      await setRow.locator('input').nth(0).fill(String(set[0]))
      await setRow.locator('input').nth(1).fill(String(set[1]))
    }
    await dialog.getByRole('button', { name: 'Salvar resultado' }).click()
    await expect(page.getByText('Resultado salvo! Classificação atualizada.')).toBeVisible()
    await expect(confirmedRow.getByText('(3-0)')).toBeVisible()
  })
})

test.describe('/admin — aba Datas disponíveis', () => {
  test('cria uma data disponível para uma categoria', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Datas disponíveis' }).click()

    await page.getByRole('button', { name: 'Selecione uma data' }).click()
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).getDate()
    await page.locator('button').filter({ hasText: new RegExp(`^${tomorrow}$`) }).click()
    await page.locator('#game-venue').fill(`Ginásio E2E ${Date.now()}`)
    await page.getByRole('button', { name: 'Criar data disponível' }).click()

    await expect(page.getByText('Concluído', { exact: true })).toBeVisible()
    await expect(page.getByText('Data disponível criada com sucesso.')).toBeVisible()
  })

  test('sem data selecionada, mostra erro de validação ao tentar salvar', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Datas disponíveis' }).click()
    await expect(page.getByRole('button', { name: 'Criar data disponível' })).toBeDisabled()
  })
})

test.describe('/admin — aba Presença', () => {
  test('registra presença manual e calcula a elegibilidade (Apto)', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[0]
    const { team, athlete } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Presença' }).click()

    await page.locator('#admin-attendance-team').click()
    await page.getByRole('option', { name: team.name, exact: true }).click()

    const athleteRow = page.getByLabel(new RegExp(athlete.name))
    await expect(athleteRow).toBeChecked()
    await page.getByRole('button', { name: 'Registrar presença' }).click()
    await expect(page.getByText('Presença registrada')).toBeVisible()

    await expect(page.getByText('Apto', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Importar súmula (MOCKED)' }).click()
    await expect(page.getByText('Súmula importada (MOCKED - sem OCR real)')).toBeVisible()
  })
})
