import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Liga de Voleibol Jundiaí (LVJ)',
  description: 'Sistema oficial da Liga de Voleibol Jundiaí: classificação, agenda, equipes e atletas.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}