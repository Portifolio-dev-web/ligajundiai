import './globals.css'
import { headers } from 'next/headers'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'

// ACESSIBILIDADE (varredura, item A4): o título da aba nunca mudava de tela — com várias abas
// abertas (/gestor, /gestor/aprovar-atletas, /jogos...) não dava para distinguir uma da outra.
// O "template" aplica o sufixo automaticamente quando uma página de servidor exporta seu próprio
// "title" (ex.: app/jogos/page.jsx); páginas de cliente ('use client') não podem exportar metadata
// do Next, então usam document.title com o mesmo sufixo escrito à mão (ver cada página).
const siteName = 'Liga de Voleibol Jundiaí (LVJ)'
const siteDescription = 'Sistema oficial da Liga de Voleibol Jundiaí: classificação, agenda, equipes e atletas.'
// SEO (varredura, item E1): sem metadataBase o Next não consegue resolver a URL absoluta das
// imagens de openGraph/twitter abaixo (nem a de sitemap.js/robots.js) — precisa vir de uma env var
// porque o domínio final só existe em produção. NEXT_PUBLIC_SITE_URL é definida no serviço
// "frontend" do compose.yaml; sem ela, cai no endereço de desenvolvimento (não serve para produção).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  // SEO (varredura, item E1): sem Open Graph/Twitter Card, o link compartilhado no WhatsApp ou
  // Instagram (forma comum de divulgação de uma liga esportiva) aparecia sem título, descrição ou
  // imagem — só a URL crua. A imagem reaproveita a capa já usada em app/page.js (1600x1067; ver
  // nota em next.config.js sobre não haver otimização automática dela).
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    siteName,
    images: [{ url: '/images/hero.jpg', width: 1600, height: 1067, alt: 'Quadra de vôlei da Liga de Voleibol Jundiaí' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: ['/images/hero.jpg'],
  },
}

export default async function RootLayout({ children }) {
  // SEGURANÇA (varredura, item S4): o CSP agora exige "nonce-<valor>" em script-src (ver
  // middleware.js). Sem repassar esse mesmo nonce para este script inline, o navegador bloquearia
  // justamente o script que ignora um erro inofensivo de performance do servidor.
  const nonce = (await headers()).get('x-nonce')
  return (
    <html lang="pt-BR">
      <head>
        {/* SEGURANÇA/HIDRATAÇÃO: por padrão de segurança do navegador, o atributo "nonce" é
            ocultado do DOM assim que a tag <script> é inserida (getAttribute/nonce voltam "").
            O React compara esse "" no cliente com o nonce real enviado pelo servidor e aponta um
            mismatch de hidratação — só que esse diff é esperado, não é um bug real; por isso
            suprimimos o aviso só aqui. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}}
        />
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
        {/* CORREÇÃO (achado ao escrever a suíte Playwright, 2026-10-24): toastSuccess/toastError
            (AdminDashboard.jsx e suas abas) nunca apareciam na tela — não havia nenhum <Toaster/>
            montado em /admin nem no layout raiz, só em app/page.js. Centralizado aqui (removido de
            page.js) para valer no site inteiro com uma única instância — dois <Toaster/> ao mesmo
            tempo duplicariam cada toast na tela, já que ambos escutam a mesma fila global do Sonner. */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}