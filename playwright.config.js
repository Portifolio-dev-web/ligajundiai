import { defineConfig, devices } from '@playwright/test'

// Como rodar: o stack completo (frontend + api + postgres + redis + fila de SMS/e-mail) precisa
// estar de pé primeiro — `docker compose up -d` na raiz do projeto. Este arquivo só aponta para o
// frontend já em execução; ele não sabe subir Postgres/Redis, então não tenta.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // SEGURANÇA/DADOS: o teste do administrador troca a senha da conta seedada e depois restaura o
  // valor original (ver e2e/forgot-password.spec.js) — rodar fora de paralelo evita que outro
  // teste tente logar como admin no meio dessa janela.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
