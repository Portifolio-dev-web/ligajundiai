import { test, expect } from '@playwright/test'

test.describe('Páginas públicas de conteúdo', () => {
  test('/ajuda carrega, descreve a recuperação de senha atual e linka para o cadastro de atleta', async ({ page }) => {
    await page.goto('/ajuda')
    await expect(page.getByText('Central de Ajuda', { exact: true })).toBeVisible()
    // A cópia desta seção ficou obsoleta depois que o fluxo de recuperação de senha foi implementado
    // (dizia que a recuperação "não existe") — este teste trava a versão corrigida.
    await expect(page.getByText(/Esqueci minha senha — e agora\?/)).toBeVisible()
    await expect(page.getByText(/código do próprio app autenticador/)).toBeVisible()
    await expect(page.getByText(/não tem recuperação automática de senha/)).not.toBeVisible()
    await page.getByRole('link', { name: '/cadastro-atleta' }).click()
    await expect(page).toHaveURL(/\/cadastro-atleta$/)
  })

  test('/privacidade carrega a Política de Privacidade', async ({ page }) => {
    await page.goto('/privacidade')
    await expect(page.getByText('Política de Privacidade', { exact: true })).toBeVisible()
  })

  test('/termos-de-uso carrega os Termos de Uso', async ({ page }) => {
    await page.goto('/termos-de-uso')
    await expect(page.getByText('Termos de Uso', { exact: true })).toBeVisible()
  })

  test('/ajuda e /privacidade e /termos-de-uso têm link de volta para a página inicial', async ({ page }) => {
    await page.goto('/ajuda')
    await page.getByRole('link', { name: 'Página inicial' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Página inicial (visitante)', () => {
  test('hero, CTAs e rodapé', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /A casa do vôlei em\s*Jundiaí/ })).toBeVisible()

    // "Inscrever minha equipe" e "Ver classificação" não navegam — abrem o login / rolam a página.
    await page.getByRole('button', { name: 'Inscrever minha equipe' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Rodapé: os três links de conteúdo legal/ajuda.
    await expect(page.getByRole('link', { name: 'Ajuda' })).toHaveAttribute('href', '/ajuda')
    await expect(page.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
    await expect(page.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', '/termos-de-uso')
    await expect(page.getByText('contato@lvj.com.br')).toBeVisible()
  })

  test('"Cadastrar atleta" no hero leva ao cadastro público', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Cadastrar atleta' }).click()
    await expect(page).toHaveURL(/\/cadastro-atleta$/)
  })

  test('seção Classificação troca de categoria', async ({ page }) => {
    await page.goto('/')
    const section = page.locator('#classificacao')
    await expect(section.getByRole('heading', { name: 'Classificação' })).toBeVisible()

    const trigger = section.getByRole('combobox')
    const initialCategory = (await trigger.textContent())?.trim()
    await trigger.click()
    // Escolhe qualquer opção visível diferente da atual.
    const options = page.getByRole('option')
    const count = await options.count()
    let changed = false
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent())?.trim()
      if (text && text !== initialCategory) {
        await options.nth(i).click()
        changed = true
        break
      }
    }
    expect(changed).toBe(true)
    await expect(trigger).not.toHaveText(initialCategory || '')
  })
})
