'use client'

import { useState } from 'react'
import { LogOut, LoaderCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

// ACESSIBILIDADE (varredura, item A10): antes só o TopNav da home (app/page.js) tinha botão de
// sair — nas 6 telas internas (gestor e admin) não havia nenhum jeito de encerrar a sessão sem
// voltar até a home primeiro. Em computador compartilhado (ex.: secretaria do clube), isso é risco
// de privacidade, não só inconveniência. Um componente só, reaproveitado nas 6 telas, para não
// duplicar a lógica de logout em cada uma.
export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = async () => {
    setLoggingOut(true)
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      // Mesmo se a chamada falhar (sessão já expirada, rede), ainda assim manda para a home —
      // o cookie HttpOnly só o backend consegue limpar de verdade, mas não há nada mais a fazer
      // por aqui além de tirar a pessoa da tela protegida.
    } finally {
      window.location.href = '/'
    }
  }

  return (
    // UX (auditoria de leis de UX, Lei de Murphy): logout disparava a sessão imediatamente num
    // único clique/toque, ao lado de "Ajuda" — agora exige confirmação explícita.
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={loggingOut}>
          {loggingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
          <AlertDialogDescription>Você precisará entrar novamente para acessar o painel.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={logout}>Sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
