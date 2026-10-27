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

// UX (redesign do painel do gestor, aprovado por mockup): a aba "Aprovar atletas" dentro do
// Painel do Gestor é NOVA — uma fila só de pendentes, com contador na própria aba — mas a decisão
// do usuário foi manter também a aprovação inline que já existia na aba Elenco, então as duas
// formas de aprovar/recusar coexistem apontando para o mesmo estado (mesma lista de atletas,
// levantada uma vez em GestorPanel — ver components/gestor/GestorPanel.jsx).
test.describe('Painel do gestor — aba Aprovar atletas', () => {
  test('aprova pela aba nova, o contador cai e o Elenco continua com a aprovação inline', async ({ page, request, baseURL }) => {
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })
    const managerCtxLogin = await loginAsManager(baseURL, manager)
    const nameA = `Atleta Fila A ${Date.now()}`
    const nameB = `Atleta Fila B ${Date.now()}`
    await createAthleteAsManager(managerCtxLogin, baseURL, team.id, { name: nameA })
    await createAthleteAsManager(managerCtxLogin, baseURL, team.id, { name: nameB })
    await managerCtxLogin.dispose()

    await loginPageAsManager(page, manager)
    await page.goto('/')

    const tab = page.getByRole('tab', { name: /Aprovar atletas/ })
    await expect(tab.getByText('2', { exact: true })).toBeVisible()
    await tab.click()

    await expect(page.getByText(nameA)).toBeVisible()
    await expect(page.getByText(nameB)).toBeVisible()
    // As linhas (sem <table>, mesmo estilo de card usado no Elenco) não têm um role próprio —
    // a classe combinada identifica a linha sem ambiguidade com o resto da tela.
    const queueRowA = page.locator('.rounded-lg.border.p-3', { hasText: nameA })
    await queueRowA.getByRole('button', { name: 'Aprovar' }).click()

    await expect(page.getByText(nameA)).not.toBeVisible()
    await expect(tab.getByText('1', { exact: true })).toBeVisible()

    // Decisão do usuário: manter a aprovação inline da aba Elenco também — o atleta B, ainda
    // pendente, precisa aparecer lá com os mesmos botões Aprovar/Recusar.
    await page.getByRole('tab', { name: 'Elenco' }).click()
    const rosterRowB = page.locator('.rounded-lg.border.p-3', { hasText: nameB })
    await expect(rosterRowB.getByRole('button', { name: 'Aprovar' })).toBeVisible()
    await expect(rosterRowB.getByRole('button', { name: 'Recusar' })).toBeVisible()
  })
})

// PERFORMANCE/UX (redesign do painel do gestor, aprovado por mockup): /gestor/jogos virou um
// redirect para "/" (ver app/gestor/jogos/page.jsx) — aceitar data e consultar a agenda agora
// vivem na aba "Agenda" do Painel do Gestor (components/gestor/tabs/GestorAgenda.jsx).
test.describe('Painel do gestor — aba Agenda', () => {
  test('aceita uma data proposta pelo administrador', async ({ page, request, baseURL }) => {
    const category = CATEGORIES[2]
    const { manager: managerA, team: teamA } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const { team: teamB } = await createApprovedTeam(request, baseURL, adminCtx, { category })
    const match = await createMatch(adminCtx, baseURL, teamA.id, teamB.id)

    await loginPageAsManager(page, managerA)
    await page.goto('/')
    await page.getByRole('tab', { name: 'Agenda' }).click()

    // A categoria pode já ter outras partidas "Aguardando aceite" de outros testes da suíte —
    // escopar à própria linha (mesma classe das linhas sem <table> da aba) evita ambiguidade.
    // GestorAgenda junta os nomes com "x" minúsculo (diferente do "×" da antiga /gestor/jogos).
    const row = page.locator('.rounded-lg.border.p-3', { hasText: `${teamA.name} x ${teamB.name}` })
    await expect(row).toBeVisible()
    await expect(row.getByText('Aguardando aceite')).toBeVisible()
    await row.getByRole('button', { name: 'Aceitar data' }).click()

    await expect(row.getByText('Seu aceite foi registrado')).toBeVisible()
    await expect(row.getByRole('button', { name: 'Aceitar data' })).not.toBeVisible()
    void match
  })

  test('sem jogos propostos para a equipe, não mostra "Aceitar data"', async ({ page, request, baseURL }) => {
    // Diferente da antiga /gestor/jogos (filtrava só os jogos das equipes do gestor), a aba Agenda
    // mostra TODOS os jogos da categoria — outros testes da suíte podem já ter criado partidas na
    // mesma categoria. O que importa verificar é que, sem nenhum jogo envolvendo ESTA equipe,
    // nenhum "Aceitar data" aparece para ela (a asserção não assume a categoria inteira vazia).
    const { manager, team } = await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })
    await loginPageAsManager(page, manager)
    await page.goto('/')
    await page.getByRole('tab', { name: 'Agenda' }).click()
    // Escopado ao tabpanel: o nome da equipe também aparece no card acima das abas (fora da
    // Agenda), então checar a página inteira daria falso negativo.
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByText(`Agenda • ${CATEGORIES[0]}`)).toBeVisible()
    await expect(panel.getByText(new RegExp(team.name))).not.toBeVisible()
    await expect(panel.getByRole('button', { name: 'Aceitar data' })).not.toBeVisible()
  })
})
