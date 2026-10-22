'use client'

import { useState } from 'react'
import { LogOut, LoaderCircle } from 'lucide-react'
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
    <Button variant="outline" size="sm" onClick={logout} disabled={loggingOut}>
      {loggingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Sair
    </Button>
  )
}
