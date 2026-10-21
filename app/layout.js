import './globals.css'
import { headers } from 'next/headers'
import { Providers } from './providers'

// ACESSIBILIDADE (varredura, item A4): o título da aba nunca mudava de tela — com várias abas
// abertas (/gestor, /gestor/aprovar-atletas, /jogos...) não dava para distinguir uma da outra.
// O "template" aplica o sufixo automaticamente quando uma página de servidor exporta seu próprio
// "title" (ex.: app/jogos/page.jsx); páginas de cliente ('use client') não podem exportar metadata
// do Next, então usam document.title com o mesmo sufixo escrito à mão (ver cada página).
export const metadata = {
  title: {
    default: 'Liga de Voleibol Jundiaí (LVJ)',
    template: '%s | Liga de Voleibol Jundiaí (LVJ)',
  },
  description: 'Sistema oficial da Liga de Voleibol Jundiaí: classificação, agenda, equipes e atletas.',
}

export default async function RootLayout({ children }) {
  // SEGURANÇA (varredura, item S4): o CSP agora exige "nonce-<valor>" em script-src (ver
  // middleware.js). Sem repassar esse mesmo nonce para este script inline, o navegador bloquearia
  // justamente o script que ignora um erro inofensivo de performance do servidor.
  const nonce = (await headers()).get('x-nonce')
  return (
    <html lang="pt-BR">
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        {/* ACESSIBILIDADE (varredura, item A1): antes não havia como pular a navegação/hero por
            teclado — quem usa só teclado ou leitor de tela tinha que passar por tudo até o
            conteúdo. Fica escondido visualmente e só aparece quando recebe foco (Tab). O alvo
            "#main-content" é o <main> de cada página (app/page.js e as páginas em app/*). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2"
        >
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}