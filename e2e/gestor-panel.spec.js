import { test, expect } from '@playwright/test'
import {
  loginAsAdmin, loginAsManager, createApprovedTeam, createAthleteAsManager, createMatch, CATEGORIES, closeDb,
} from './helpers.js'

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

async function loginPageAsManager(page, { email, password }) {
  const response = await page.request.post('/api/auth/login-password', { data: { email, password } })
  if (!response.ok()) throw new Error(`login do gestor falhou: HTTP ${response.status()} ${await response.text()}`)
}

test.describe('Painel do gestor — cadastro de equipe', () => {
  test('/gestor — cadastra uma equipe pela tela e vê o status pendente', async ({ page, request, baseURL }) => {
    const { manager } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[2] })
    // createApprovedTeam já aprova UMA equipe para este gestor — este teste cadastra uma SEGUNDA,
    // pela tela, para conferir o formulário sem depender da equipe já aprovada.
    await loginPageAsManager(page, manager)
    await page.goto('/gestor')

    const teamName = `Equipe UI ${Date.now()}`
    await page.locator('#team-name').fill(teamName)
    await page.locator('#team-category').click()
    await page.getByRole('option', { name: CATEGORIES[2] }).click()
    await page.locator('label', { hasText: 'Li e aceito o Termo de Responsabilidade Financeira acima.' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Enviar equipe' }).click()

    await expect(page.getByText(teamName, { exact: true })).toBeVisible()
    await expect(page.getByText('Pendente de aprovação pelo Admin')).toBeVisible()
  })

  test('/ (painel embutido) — cadastra uma equipe e recebe o toast de sucesso', async ({ page, request, baseURL }) => {
    const manager = (await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[3] })).manager
    await loginPageAsManager(page, manager)
    await page.goto('/')

    const teamName = `Equipe UI Home ${Date.now()}`
    await page.locator('#gestor-team-name').fill(teamName)
    await page.locator('#gestor-team-category').click()
    await page.getByRole('option', { name: CATEGORIES[3] }).click()
    await page.locator('label', { hasText: 'Li e aceito o Termo de Responsabilidade Financeira acima.' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Solicitar inscrição' }).click()

    await expect(page.getByText('Equipe enviada para aprovação!')).toBeVisible()
  })
})

test.describe('Painel do gestor — aprovação de atletas', () => {
  test('/gestor/aprovar-atletas — aprova um atleta pendente', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })
    const managerCtxLogin = await loginAsManager(baseURL, manager)
    const athleteName = `Atleta Aprovar ${Date.now()}`
    const athlete = await createAthleteAsManager(managerCtxLogin, baseURL, team.id, { name: athleteName })
    await managerCtxLogin.dispose()

    await loginPageAsManager(page, manager)
    await page.goto('/gestor/aprovar-atletas')

    const row = page.getByRole('row', { name: new RegExp(athlete.name) })
    await expect(row).toBeVisible()
    await expect(row.getByText('Aguardando gestor')).toBeVisible()
    await row.getByRole('button', { name: 'Aprovar' }).click()

    await expect(page.getByRole('row', { name: new RegExp(athleteName) })).not.toBeVisible()
  })

  test('/gestor/aprovar-atletas — rejeita um atleta com justificativa', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[1] })
    const managerCtxLogin = await loginAsManager(baseURL, manager)
    const athleteName = `Atleta Rejeitar ${Date.now()}`
    const athlete = await createAthleteAsManager(managerCtxLogin, baseURL, team.id, { name: athleteName })
    await managerCtxLogin.dispose()

    await loginPageAsManager(page, manager)
    await page.goto('/gestor/aprovar-atletas')

    const row = page.getByRole('row', { name: new RegExp(athlete.name) })
    await row.getByRole('button', { name: 'Rejeitar' }).click()
    await row.getByLabel('Motivo da rejeição').fill('Documentação incompleta (teste E2E)')
    await row.getByRole('button', { name: 'Confirmar' }).click()

    await expect(page.getByRole('row', { name: new RegExp(athleteName) })).not.toBeVisible()
  })

  test('/gestor/aprovar-atletas — sem pendências mostra o estado vazio', async ({ page, request, baseURL }) => {
    const { manager } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[4] })
    await loginPageAsManager(page, manager)
    await page.goto('/gestor/aprovar-atletas')
    await expect(page.getByText('Nenhum atleta aguardando análise.')).toBeVisible()
  })
})

test.describe('Painel do gestor — agenda de jogos', () => {
  test('/gestor/jogos — aceita uma data proposta pelo administrador', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[5]
    const { manager: managerA, team: teamA } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { team: teamB } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const match = await createMatch(adminCtx, baseURL, teamA.id, teamB.id)

    await loginPageAsManager(page, managerA)
    await page.goto('/gestor/jogos')

    await expect(page.getByText(`${teamA.name} × ${teamB.name}`)).toBeVisible()
    await expect(page.getByText('Aguardando aceite')).toBeVisible()
    await page.getByRole('button', { name: 'Aceitar data' }).click()

    await expect(page.getByText('Seu aceite foi registrado')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aceitar data' })).not.toBeVisible()
    void match
  })

  test('/gestor/jogos — sem jogos propostos mostra o estado vazio', async ({ page, request, baseURL }) => {
    const { manager } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })
    await loginPageAsManager(page, manager)
    await page.goto('/gestor/jogos')
    await expect(page.getByText('Não há jogos propostos para suas equipes.')).toBeVisible()
  })
})
