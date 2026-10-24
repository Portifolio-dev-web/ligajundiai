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
  // A suíte roda contra "next dev" (não um build de produção) no stack de desenvolvimento — uma
  // recompilação de rota sob carga (vários testes em sequência) ocasionalmente atrasa a primeira
  // navegação a uma página além do timeout padrão. 1 retry absorve esse tipo de flake sem mascarar
  // uma falha real (que falha de novo no retry).
  retries: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // O cadastro público de atleta (e2e/cadastro-atleta.spec.js) usa a câmera de verdade
    // (getUserMedia) — estas duas flags do Chromium trocam por um dispositivo de vídeo sintético
    // e aprovam a permissão automaticamente, sem precisar mockar nada em JS. Inofensivo para os
    // demais testes, que nunca chamam getUserMedia.
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
