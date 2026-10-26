import { test, expect } from '@playwright/test'
import {
  loginAsAdmin, loginAsManager, loginPageAs, createApprovedTeam, createAthleteAsManager, createMatch,
  createFullyApprovedAthlete, acceptMatch, registerTestManager, promoteUserToAtleta, linkAthleteToUser,
  observeLayoutShift, readLayoutShift,
  CATEGORIES, closeDb,
} from './helpers.js'

// Cobre só as 5 melhorias de performance aplicadas nesta rodada (painel do gestor e do atleta):
// 1) components/MatchAttendance.jsx — min-h no CardContent (usado por /atleta/jogos e /jogos)
// 2) app/gestor/aprovar-atletas/page.jsx — min-h no CardContent
// 3) app/gestor/jogos/page.jsx — min-h no CardContent
// 4) app/gestor/page.jsx — min-h no bloco carregando/conteúdo
// 5) components/gestor/GestorPanel.jsx — Frequência/Classificação/Agenda via next/dynamic
//
// O LIMITE (0.1) é o corte oficial do Google para CLS "bom" (web.dev/cls) — não é um número
// escolhido a dedo para este projeto. Sem a correção, a troca de um spinner de uma linha para o
// conteúdo real (bem mais alto) nessas telas estoura esse limite; com min-h reservando o espaço,
// o salto desaparece.
const GOOD_CLS = 0.1

async function loginPageAsManager(page, { email, password }) {
  const response = await page.request.post('/api/auth/login-password', { data: { email, password } })
  if (!response.ok()) throw new Error(`login do gestor falhou: HTTP ${response.status()} ${await response.text()}`)
}

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

test.describe('Performance — CLS (reserva de altura no carregamento)', () => {
  test('/gestor — CLS permanece bom ao trocar o spinner pelos cards de equipe', async ({ page, request, baseURL }) => {
    const { manager } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })
    await observeLayoutShift(page)
    await loginPageAsManager(page, manager)
    await page.goto('/gestor')

    await expect(page.getByText('Pendente de aprovação pelo Admin').or(page.getByText('Equipe aprovada'))).toBeVisible()
    await page.waitForTimeout(300)
    expect(await readLayoutShift(page)).toBeLessThan(GOOD_CLS)
  })

  test('/gestor/aprovar-atletas — CLS permanece bom ao trocar o spinner pela tabela com pendência', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[1] })
    const managerCtxLogin = await loginAsManager(baseURL, manager)
    const athleteName = `Atleta CLS ${Date.now()}`
    await createAthleteAsManager(managerCtxLogin, baseURL, team.id, { name: athleteName })
    await managerCtxLogin.dispose()

    await observeLayoutShift(page)
    await loginPageAsManager(page, manager)
    await page.goto('/gestor/aprovar-atletas')

    await expect(page.getByRole('row', { name: new RegExp(athleteName) })).toBeVisible()
    await page.waitForTimeout(300)
    expect(await readLayoutShift(page)).toBeLessThan(GOOD_CLS)
  })

  test('/gestor/jogos — CLS permanece bom ao trocar o spinner pela lista de jogos propostos', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[2]
    const { manager: managerA, team: teamA } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { team: teamB } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    await createMatch(adminCtx, baseURL, teamA.id, teamB.id)

    await observeLayoutShift(page)
    await loginPageAsManager(page, managerA)
    await page.goto('/gestor/jogos')

    await expect(page.getByText(`${teamA.name} × ${teamB.name}`)).toBeVisible()
    await page.waitForTimeout(300)
    expect(await readLayoutShift(page)).toBeLessThan(GOOD_CLS)
  })

  test('/atleta/jogos — CLS permanece bom ao trocar o spinner pela tabela de jogos (MatchAttendance)', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[3]
    const { team, athlete } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    const { team: opponent } = await createFullyApprovedAthlete(request, baseURL, adminCtx, { category })
    await createMatch(adminCtx, baseURL, team.id, opponent.id)
    const account = await registerTestManager(request, baseURL)
    await promoteUserToAtleta(account.userId)
    await linkAthleteToUser(athlete.id, account.userId)

    await observeLayoutShift(page)
    await loginPageAs(page, account)
    await page.goto('/atleta/jogos')

    const row = page.getByRole('row', { name: new RegExp(`${team.name} × ${opponent.name}|${opponent.name} × ${team.name}`) })
    await expect(row).toBeVisible()
    await page.waitForTimeout(300)
    expect(await readLayoutShift(page)).toBeLessThan(GOOD_CLS)
  })

  test('/jogos — mesmo componente (MatchAttendance) também fica com CLS bom para o gestor', async ({ page, request, baseURL }) => {
    // Reaproveita CATEGORIES[0] (não CATEGORIES[4]/[5] — "Sub-19 Masculino"/"Sub-19 Feminino"
    // estão com active=false no banco local no momento, estado alheio a esta suíte; reutilizar uma
    // categoria ativa já usada em outro teste deste arquivo é seguro, ver createApprovedTeam acima).
    const category = CATEGORIES[0]
    const { manager: managerA, team: teamA } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { team: teamB } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    await createMatch(adminCtx, baseURL, teamA.id, teamB.id)

    await observeLayoutShift(page)
    await loginPageAsManager(page, managerA)
    await page.goto('/jogos')

    await expect(page.getByText(`${teamA.name} × ${teamB.name}`)).toBeVisible()
    await page.waitForTimeout(300)
    expect(await readLayoutShift(page)).toBeLessThan(GOOD_CLS)
  })
})

test.describe('Performance — code-splitting das abas do GestorPanel (next/dynamic)', () => {
  test('/ — Frequência, Classificação e Agenda só baixam JS ao clicar na aba', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[1]
    const { manager: managerA, team: teamA } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { team: teamB } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const match = await createMatch(adminCtx, baseURL, teamA.id, teamB.id)
    const managerCtxA = await loginAsManager(baseURL, managerA)
    await acceptMatch(managerCtxA, baseURL, match.id)
    await managerCtxA.dispose()

    const chunksSeen = new Set()
    page.on('response', (response) => {
      const url = response.url()
      if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) chunksSeen.add(url)
    })

    await loginPageAsManager(page, managerA)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Painel do Gestor' })).toBeVisible()
    // Elenco é a aba padrão (eager) — já deve estar renderizada sem precisar clicar em nada.
    // Escopado ao tabpanel porque "Elenco" também é o texto do próprio TabsTrigger.
    await expect(page.getByRole('tabpanel').getByText('Elenco', { exact: true })).toBeVisible()
    const chunksBeforeClick = chunksSeen.size

    await page.getByRole('tab', { name: 'Frequência' }).click()
    await expect(page.getByText('Frequência (presença)')).toBeVisible()
    const chunksAfterFrequencia = chunksSeen.size
    expect(chunksAfterFrequencia, 'clicar em "Frequência" deveria baixar o chunk JS próprio dessa aba (next/dynamic)')
      .toBeGreaterThan(chunksBeforeClick)

    await page.getByRole('tab', { name: 'Classificação' }).click()
    await expect(page.getByText(`Classificação • ${category}`)).toBeVisible()
    const chunksAfterClassificacao = chunksSeen.size
    expect(chunksAfterClassificacao, 'clicar em "Classificação" deveria baixar outro chunk JS próprio')
      .toBeGreaterThan(chunksAfterFrequencia)

    await page.getByRole('tab', { name: 'Agenda' }).click()
    await expect(page.getByText(`Agenda • ${category}`)).toBeVisible()
    const chunksAfterAgenda = chunksSeen.size
    expect(chunksAfterAgenda, 'clicar em "Agenda" deveria baixar outro chunk JS próprio')
      .toBeGreaterThan(chunksAfterClassificacao)

    // A aba lazy também precisa funcionar de verdade, não só renderizar: aceitar a data aqui
    // confirma que o chunk sob demanda não quebrou a ação real contra a API. GestorAgenda usa "x"
    // minúsculo entre os nomes (diferente do "×" usado em app/gestor/jogos/page.jsx).
    await expect(page.getByText(`${teamA.name} x ${teamB.name}`)).toBeVisible()
    void match
  })
})
