'use client'

// UX (varredura, item I2): sem este arquivo, uma exceção não tratada no render mostrava a tela
// de erro genérica do Next (sem o visual do site, sem botão de "tentar novamente"). O Next exige
// que este arquivo seja Client Component — é ele quem decide o que a tela mostra quando algo
// quebra dentro de app/page.js e das demais rotas (não cobre erro no próprio app/layout.js;
// para isso existe app/global-error.js).
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function Error({ error, reset }) {
  useEffect(() => {
    // Mantém no console do navegador para investigação; não envia dado pessoal, só o erro técnico.
    console.error(error)
  }, [error])

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <AlertTriangle className="mb-2 h-10 w-10 text-destructive" aria-hidden="true" />
          <CardTitle>Algo deu errado</CardTitle>
          <CardDescription>
            Ocorreu um erro inesperado ao carregar esta página. Tente novamente; se o problema
            continuar, fale com a organização da liga pela <Link className="underline" href="/ajuda">Central de ajuda</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button onClick={() => reset()}>Tentar novamente</Button>
          <Button variant="outline" asChild><Link href="/">Página inicial</Link></Button>
        </CardContent>
      </Card>
    </main>
  )
}
