import { test, expect } from '@playwright/test'
import {
  loginAsAdmin, loginPageAs, createFullyApprovedAthlete, createMatch, acceptMatch, registerTestManager,
  promoteUserToAtleta, linkAthleteToUser, markAthleteBiometrySynced, simulateTurnstileCheckIn,
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

// Cria uma conta de login (sempre role=gestor via /api/auth/register) e promove para atleta,
// depois liga ela a um `athletes` já aprovado — é o que GET /api/attendance/athlete/mine exige
// (athletes.user_id = req.user.id) para encontrar os próprios registros de presença.
async function createLoginableAthlete(request, baseURL, athlete) {
  const account = await registerTestManager(request, baseURL)
  await promoteUserToAtleta(account.userId)
  await linkAthleteToUser(athlete.id, account.userId)
  return account
}


test.describe('Painel do atleta', () => {
  test('/atleta/jogos — mostra presença confirmada e permite gerar a declaração', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[0]
    const { managerCtx, team, athlete } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    const { managerCtx: opponentManagerCtx, team: opponent } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    const match = await createMatch(adminCtx, baseURL, team.id, opponent.id)
    // Presença amarrada a um jogo só existe via o webhook da catraca (ver helpers.js) — precisa do
    // jogo confirmado pelos dois lados e do atleta com biometria "sincronizada".
    await acceptMatch(managerCtx, baseURL, match.id)
    await acceptMatch(opponentManagerCtx, baseURL, match.id)
    const controlIdReference = `e2e-control-id-${athlete.id}`
    await markAthleteBiometrySynced(athlete.id, controlIdReference)
    await simulateTurnstileCheckIn(request, baseURL, { matchId: match.id, controlIdReference })

    const account = await createLoginableAthlete(request, baseURL, athlete)

    await loginPageAs(page, account)
    await page.goto('/atleta/jogos')
    // PERFORMANCE/UX (redesign do painel do atleta, aprovado por mockup): o jogo (já ocorrido,
    // já que createMatch sem scheduled_at explícito usa "agora") mora na aba "Presença", não mais
    // numa tabela única — ver components/atleta/AtletaPanel.jsx.
    await page.getByRole('tab', { name: 'Presença' }).click()

    const row = page.getByRole('row', { name: new RegExp(`${team.name} × ${opponent.name}|${opponent.name} × ${team.name}`) })
    await expect(row).toBeVisible()
    await expect(row.getByText('Presente')).toBeVisible()

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      row.getByRole('button', { name: 'Gerar declaração' }).click(),
    ])
    await expect(popup).toHaveTitle('Declaração de participação')
    await popup.close()
  })

  test('/atleta/jogos — jogo passado sem presença registrada mostra "Não registrada"', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[1]
    const { team, athlete } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    const { team: opponent } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    const match = await createMatch(adminCtx, baseURL, team.id, opponent.id, {
      scheduled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    })
    const account = await createLoginableAthlete(request, baseURL, athlete)

    await loginPageAs(page, account)
    await page.goto('/atleta/jogos')
    await page.getByRole('tab', { name: 'Presença' }).click()

    const row = page.getByRole('row', { name: new RegExp(`${team.name} × ${opponent.name}|${opponent.name} × ${team.name}`) })
    await expect(row).toBeVisible()
    await expect(row.getByText('Não registrada')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Gerar declaração' })).not.toBeVisible()
    void match
  })

  test('/atleta — redireciona para /atleta/jogos e usa "Sair" para voltar ao site público', async ({ page, request, baseURL }) => {
    const account = await registerTestManager(request, baseURL)
    await promoteUserToAtleta(account.userId)
    await loginPageAs(page, account)
    await page.goto('/atleta')
    await expect(page).toHaveURL(/\/atleta\/jogos$/)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Entrar' }).first()).toBeVisible()
  })
})
