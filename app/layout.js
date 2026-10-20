import './globals.css'
import { headers } from 'next/headers'
import { Providers } from './providers'

export const metadata = {
  title: 'Liga de Voleibol Jundiaí (LVJ)',
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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}