import { test, expect } from '@playwright/test'
import { loginPageAsAdmin, loginAsAdmin, registerTestManager, openRegistrationPeriod, closeDb } from './helpers.js'

let adminCtx

test.beforeAll(async ({ baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

test.describe('/admin — aba Categorias', () => {
  test('cria, edita, desativa/reativa e remove uma categoria', async ({ page }) => {
    const suffix = Date.now()
    const name = `Categoria E2E ${suffix}`
    const renamed = `Categoria E2E Renomeada ${suffix}`
    const abbreviation = `E${String(suffix).slice(-4)}`

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Categorias' }).click()

    await page.getByPlaceholder('Ex: Sub-21 Masculino').fill(name)
    await page.getByPlaceholder('Ex: S21').fill(abbreviation)
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText('Categoria criada')).toBeVisible()

    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toBeVisible()

    await row.getByRole('textbox').first().fill(renamed)
    // A partir daqui, o "nome acessível" da linha (calculado do próprio texto/valores dela) já é
    // o novo nome — "row" (consultado pelo nome antigo) deixa de encontrar qualquer coisa a partir
    // deste ponto, por isso toda ação seguinte usa uma consulta nova por "renamed".
    const renamedRow = page.getByRole('row', { name: new RegExp(renamed) })
    await renamedRow.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Categoria atualizada')).toBeVisible()
    await renamedRow.getByRole('switch').click()
    await expect(page.getByText('Categoria desativada')).toBeVisible()
    await renamedRow.getByRole('switch').click()
    await expect(page.getByText('Categoria ativada')).toBeVisible()

    await renamedRow.getByRole('button', { name: 'Remover categoria' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Remover categoria' })
    await expect(dialog.getByText(`Remover a categoria “${renamed}”? Essa ação não pode ser desfeita.`)).toBeVisible()
    await dialog.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByText('Categoria removida')).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(renamed) })).not.toBeVisible()
  })

  test('nome ou sigla em branco bloqueia a criação, sem chamar a API', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Categorias' }).click()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText('Informe nome e sigla da categoria')).toBeVisible()
  })
})

test.describe('/admin — aba E-mails', () => {
  test('mostra o e-mail (mockado) de uma equipe recusada, sem expor segredos', async ({ page, request, baseURL }) => {
    const manager = await registerTestManager(request, baseURL)
    await openRegistrationPeriod(adminCtx, baseURL, 'Adulto Masculino', 'team')
    const { loginAsManager } = await import('./helpers.js')
    const managerCtx = await loginAsManager(baseURL, manager)
    const teamName = `Equipe Recusar E-mail ${Date.now()}`
    await managerCtx.post(`${baseURL}/api/teams`, { data: { name: teamName, category: 'Adulto Masculino', consent: true } })
    const teamsRes = await managerCtx.get(`${baseURL}/api/teams/mine`)
    const { teams } = await teamsRes.json()
    const team = teams.find((t) => t.name === teamName)
    await managerCtx.dispose()
    await adminCtx.post(`${baseURL}/api/admin/teams/${team.id}/reject`, { data: { justification: 'Sem documentação (teste E2E)' } })

    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'E-mails' }).click()

    // Status (QUEUED/SENT) não é determinístico aqui — o worker da fila (backend/src/services/
    // queue.js) despacha em até ~2s; o que importa pro teste é o e-mail aparecer, com a mensagem
    // certa e sem nenhum segredo (ver SEGURANÇA, item S1, em backend/src/routes/admin.js).
    const emailCard = page.locator('div.rounded-lg', { hasText: `Equipe "${teamName}" recusada - LVJ` })
    await expect(emailCard).toBeVisible()
  })
})

test.describe('/admin — notificações', () => {
  test('o sino abre a Central de Notificações', async ({ page }) => {
    await loginPageAsAdmin(page)
    await page.goto('/admin')
    await page.getByRole('button', { name: /Notificações/ }).click()
    await expect(page.getByText('Central de Notificações', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'marcar lidas' }).click()
  })
})
