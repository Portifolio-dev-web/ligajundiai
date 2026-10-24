import { test, expect } from '@playwright/test'
import { loginAsAdmin, createApprovedTeam, uniqueEmail, uniqueRg, CATEGORIES, closeDb } from './helpers.js'

let adminCtx
let team

test.beforeAll(async ({ request, baseURL }) => {
  adminCtx = await loginAsAdmin(baseURL)
  team = (await createApprovedTeam(request, baseURL, adminCtx, { category: CATEGORIES[0] })).team
})

test.afterAll(async () => {
  await adminCtx.dispose()
  await closeDb()
})

async function fillStep0(page, { name, email, password, rg, age }) {
  await page.locator('#athlete-name').fill(name)
  await page.locator('#athlete-email').fill(email)
  await page.locator('#athlete-password').fill(password)
  await page.locator('#athlete-rg').fill(rg)
  await page.locator('#athlete-age').fill(String(age))
}

test.describe('Cadastro público de atleta', () => {
  test('fluxo completo: formulário, captura real da câmera e envio', async ({ page }) => {
    const name = `Atleta Cadastro ${Date.now()}`
    const email = uniqueEmail('atleta-e2e')

    await page.goto('/cadastro-atleta')
    await expect(page.getByText('Cadastro de atleta', { exact: true })).toBeVisible()

    await fillStep0(page, { name, email, password: 'senha-atleta-123456', rg: uniqueRg(), age: 25 })
    await page.getByRole('checkbox', { name: 'Ponteiro' }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Passo 2: equipe + câmera real (Chromium com --use-fake-device-for-media-stream).
    await page.locator('#athlete-team').click()
    await page.getByRole('option', { name: new RegExp(team.name) }).click()
    await page.getByRole('button', { name: 'Ativar câmera' }).click()
    await page.getByRole('button', { name: 'Capturar foto' }).click()
    await page.getByRole('button', { name: 'Enviar foto' }).click()
    await expect(page.getByText('Foto enviada com segurança.')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Passo 3: consentimentos + envio.
    await page.getByText('Autorizo especificamente o tratamento').locator('..').getByRole('checkbox').check()
    await page.getByText('Li e aceito o termo acima').locator('..').getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Concluir cadastro' }).click()

    await expect(page.getByText('Cadastro enviado', { exact: true })).toBeVisible()
    await expect(page.getByText(new RegExp(`cadastro de ${name} está aguardando a aprovação do gestor de ${team.name}`))).toBeVisible()
  })

  test('validações do passo 1: e-mail inválido, senha curta e RG inválido bloqueiam o avanço', async ({ page }) => {
    await page.goto('/cadastro-atleta')
    await page.locator('#athlete-name').fill('Atleta Validação')
    await page.locator('#athlete-email').fill('nao-e-um-email')
    await page.locator('#athlete-password').fill('curta')
    await page.locator('#athlete-rg').fill('1')
    await page.locator('#athlete-age').fill('20')
    await page.getByRole('checkbox', { name: 'Central' }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()

    await page.locator('#athlete-email').fill('atleta@valido.com')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('A senha deve ter pelo menos 12 caracteres.')).toBeVisible()

    await page.locator('#athlete-password').fill('senha-valida-123456')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe um RG válido.')).toBeVisible()
  })

  test('sem selecionar posição, não avança', async ({ page }) => {
    await page.goto('/cadastro-atleta')
    await fillStep0(page, { name: 'Atleta Sem Posição', email: uniqueEmail('atleta-e2e'), password: 'senha-valida-123456', rg: uniqueRg(), age: 22 })
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Selecione pelo menos uma posição.')).toBeVisible()
  })

  test('menor de idade exige os dados do responsável legal', async ({ page }) => {
    await page.goto('/cadastro-atleta')
    await fillStep0(page, { name: 'Atleta Menor', email: uniqueEmail('atleta-e2e'), password: 'senha-valida-123456', rg: uniqueRg(), age: 16 })
    await expect(page.getByText('Como o atleta é menor de idade')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Líbero' }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe o nome completo do responsável legal.')).toBeVisible()

    await page.locator('#guardian-name').fill('Responsável Teste')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe um RG válido para o responsável legal.')).toBeVisible()

    await page.locator('#guardian-rg').fill(uniqueRg())
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByText('Informe o grau de parentesco do responsável legal.')).toBeVisible()

    await page.locator('#guardian-relationship').fill('mãe')
    await page.getByRole('button', { name: 'Continuar' }).click()
    // Com tudo preenchido, avança normalmente para o passo 2.
    await expect(page.getByText('Equipe aprovada', { exact: true })).toBeVisible()
  })

  test('não é possível concluir sem os dois consentimentos (biometria + termos)', async ({ page }) => {
    await page.goto('/cadastro-atleta')
    await fillStep0(page, { name: 'Atleta Consentimento', email: uniqueEmail('atleta-e2e'), password: 'senha-valida-123456', rg: uniqueRg(), age: 30 })
    await page.getByRole('checkbox', { name: 'Levantador' }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()

    await page.locator('#athlete-team').click()
    await page.getByRole('option', { name: new RegExp(team.name) }).click()
    await page.getByRole('button', { name: 'Ativar câmera' }).click()
    await page.getByRole('button', { name: 'Capturar foto' }).click()
    await page.getByRole('button', { name: 'Enviar foto' }).click()
    await expect(page.getByText('Foto enviada com segurança.')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByRole('button', { name: 'Concluir cadastro' })).toBeDisabled()
    await page.getByText('Autorizo especificamente o tratamento').locator('..').getByRole('checkbox').check()
    await expect(page.getByRole('button', { name: 'Concluir cadastro' })).toBeDisabled()
    await page.getByText('Li e aceito o termo acima').locator('..').getByRole('checkbox').check()
    await expect(page.getByRole('button', { name: 'Concluir cadastro' })).toBeEnabled()
  })
})
