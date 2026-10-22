'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/api'

// SEGURANÇA (varredura, item S21): antes o segredo TOTP do admin só vinha de ADMIN_TOTP_SECRET,
// regravado no banco a cada boot (backend/src/db/seed-admin.js) — essa tela é o fluxo de troca de
// verdade, pelo próprio admin, com prova de posse (código atual para começar, código novo para
// confirmar) e expiração de 10 minutos se não for concluído.
export default function AdminSegurancaPage() {
  // step: 'idle' | 'pending' | 'done'
  const [step, setStep] = useState('idle')
  const [currentTotp, setCurrentTotp] = useState('')
  const [newTotp, setNewTotp] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentTotpRef = useRef(null)
  const newTotpRef = useRef(null)

  // ACESSIBILIDADE (varredura, item A4): ver o comentário em app/gestor/page.jsx.
  useEffect(() => { document.title = 'Segurança da conta | Liga de Voleibol Jundiaí (LVJ)' }, [])

  const start = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await api('/auth/totp/rotate/start', { method: 'POST', body: { current_totp: currentTotp } })
      setPending(result)
      setStep('pending')
      setCurrentTotp('')
    } catch (e) {
      setError(e.message)
      // ACESSIBILIDADE (varredura, item A12): devolve o foco pro campo pra corrigir, em vez de só
      // deixar a mensagem de erro parada no topo.
      currentTotpRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setError('')
    setBusy(true)
    try {
      await api('/auth/totp/rotate/confirm', { method: 'POST', body: { new_totp: newTotp } })
      setStep('done')
    } catch (e) {
      setError(e.message)
      newTotpRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await api('/auth/totp/rotate/cancel', { method: 'POST' })
    } catch {
      // Mesmo se a chamada falhar, não há nada sensível a esconder — o pendente expira sozinho
      // em 10 minutos (ver backend/src/routes/auth.js).
    } finally {
      setPending(null)
      setNewTotp('')
      setStep('idle')
      setBusy(false)
    }
  }

  return (
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js.
    <main id="main-content" className="mx-auto min-h-screen max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost"><Link href="/admin/aprovacoes"><ArrowLeft className="h-4 w-4" /> Aprovações</Link></Button>
        {/* ACESSIBILIDADE (varredura, item A10): ver components/LogoutButton.jsx */}
        <LogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Segurança da conta</CardTitle>
          <CardDescription>
            Troque o segredo da autenticação em dois fatores (2FA) sem depender de um redeploy. A
            troca só vale depois que você confirmar um código gerado a partir do segredo novo — até
            lá, o antigo continua sendo o válido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

          {step === 'idle' && <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-totp">Código 2FA atual</Label>
              <Input
                ref={currentTotpRef}
                id="current-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={currentTotp}
                aria-invalid={!!error}
                aria-describedby={error ? 'current-totp-error' : undefined}
                onChange={(e) => setCurrentTotp(e.target.value.replace(/\D/g, ''))}
              />
              <p id="current-totp-error" className="text-xs text-muted-foreground">
                Confirme que você ainda controla o aplicativo autenticador de hoje antes de gerar um segredo novo.
              </p>
            </div>
            <Button onClick={start} disabled={busy || currentTotp.length !== 6}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Gerar novo segredo 2FA
            </Button>
          </div>}

          {step === 'pending' && pending && <div className="space-y-4">
            <Alert>
              <AlertTitle>Adicione este segredo ao seu aplicativo autenticador</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Chave manual (Google Authenticator, Authy, 1Password…):</p>
                <p className="rounded bg-muted px-2 py-1 font-mono text-sm break-all">{pending.secret}</p>
                <p className="text-xs text-muted-foreground">Expira às {new Date(pending.expires_at).toLocaleTimeString('pt-BR')} se não for confirmado.</p>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="new-totp">Código gerado pelo segredo novo</Label>
              <Input
                ref={newTotpRef}
                id="new-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={newTotp}
                aria-invalid={!!error}
                aria-describedby={error ? 'new-totp-error' : undefined}
                onChange={(e) => setNewTotp(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy || newTotp.length !== 6}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar e ativar
              </Button>
              <Button variant="outline" onClick={cancel} disabled={busy}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>}

          {step === 'done' && <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>2FA atualizado</AlertTitle>
            <AlertDescription>O novo segredo já está ativo. Use-o no seu próximo login.</AlertDescription>
          </Alert>}
        </CardContent>
      </Card>
    </main>
  )
}
