import { test, expect } from '@playwright/test'
import {
  loginPageAsAdmin, loginAsAdmin, loginAsManager, openRegistrationPeriod,
  registerTestManager, createApprovedTeam, createAthleteAsManager, approveAthleteAsManager,
  CATEGORIES, closeDb,
} from './helpers.js'

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

test.describe('/admin — aba Equipes', () => {
  test('aprova uma equipe pendente', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[2]
    const manager = await registerTestManager(request, baseURL)
    await openRegistrationPeriod(adminCtx, baseURL, category, 'team')
    const managerCtx = await loginAsManager(baseURL, manager)
    const teamName = `Equipe Admin Aprovar ${Date.now()}`
    const teamResponse = await managerCtx.post(`${baseURL}/api/teams`, { data: { name: teamName, category, consent: true } })
    expect(teamResponse.ok()).toBe(true)
    await managerCtx.dispose()

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Equipes' }).click()

    const row = page.locator('div.rounded-lg', { has: page.getByText(teamName, { exact: true }) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('Equipe aprovada; e-mail colocado na fila')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Aprovar' })).not.toBeVisible()
  })

  test('recusa uma equipe pendente com justificativa', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[3]
    const manager = await registerTestManager(request, baseURL)
    await openRegistrationPeriod(adminCtx, baseURL, category, 'team')
    const managerCtx = await loginAsManager(baseURL, manager)
    const teamName = `Equipe Admin Recusar ${Date.now()}`
    await managerCtx.post(`${baseURL}/api/teams`, { data: { name: teamName, category, consent: true } })
    await managerCtx.dispose()

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Equipes' }).click()

    const row = page.locator('div.rounded-lg', { has: page.getByText(teamName, { exact: true }) })
    await row.getByRole('button', { name: 'Recusar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Recusar equipe' })
    await expect(dialog.getByRole('button', { name: 'Confirmar recusa' })).toBeDisabled()
    await dialog.getByPlaceholder('Ex: documentação incompleta...').fill('Documentação incompleta (teste E2E)')
    await dialog.getByRole('button', { name: 'Confirmar recusa' }).click()
    await expect(page.getByText('Equipe recusada; e-mail colocado na fila')).toBeVisible()
  })
})

test.describe('/admin — aba Atletas', () => {
  test('libera um atleta aguardando aprovação final', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[4] })
    const managerCtx = await loginAsManager(baseURL, manager)
    const athleteName = `Atleta Admin Liberar ${Date.now()}`
    const athlete = await createAthleteAsManager(managerCtx, baseURL, team.id, { name: athleteName })
    await approveAthleteAsManager(managerCtx, baseURL, athlete.id)
    await managerCtx.dispose()

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Atletas' }).click()

    const row = page.locator('div.rounded-lg', { has: page.getByText(athleteName, { exact: true }) })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Liberar' }).click()
    await expect(page.getByText('Atleta liberado; e-mail colocado na fila')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Liberar' })).not.toBeVisible()
  })

  test('recusa um atleta aguardando aprovação final', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[5] })
    const managerCtx = await loginAsManager(baseURL, manager)
    const athleteName = `Atleta Admin Recusar ${Date.now()}`
    const athlete = await createAthleteAsManager(managerCtx, baseURL, team.id, { name: athleteName })
    await approveAthleteAsManager(managerCtx, baseURL, athlete.id)
    await managerCtx.dispose()

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Atletas' }).click()

    const row = page.locator('div.rounded-lg', { has: page.getByText(athleteName, { exact: true }) })
    await row.getByRole('button', { name: 'Recusar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Recusar atleta' })
    await dialog.getByPlaceholder('Motivo da recusa...').fill('Documentação incompleta (teste E2E)')
    await dialog.getByRole('button', { name: 'Confirmar recusa' }).click()
    await expect(page.getByText('Atleta recusado; e-mail colocado na fila')).toBeVisible()
  })
})
