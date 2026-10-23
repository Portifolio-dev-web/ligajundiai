// UX/SEO (varredura, item I1): sem este arquivo, uma URL inexistente cai na tela genérica do
// Next (sem o visual do site, sem link de volta, em inglês) — ver app/ajuda/page.jsx para o
// padrão de layout (Card + botão "Página inicial") que esta página segue.
export const metadata = { title: 'Página não encontrada' }

import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function NotFound() {
  return (
    // ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js.
    <main id="main-content" className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <SearchX className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <CardTitle>Página não encontrada</CardTitle>
          <CardDescription>
            O endereço digitado não existe ou a página foi movida. Confira se a URL está correta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button asChild><Link href="/">Página inicial</Link></Button>
          <Button variant="outline" asChild><Link href="/ajuda">Central de ajuda</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}
