'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ArrowLeft, LoaderCircle, ShieldCheck, Smartphone, CheckCircle2, Check, Eye, EyeOff } from 'lucide-react'
import { api } from '@/lib/lvjApi'
import { toastSuccess, toastError } from '@/lib/toast'
import { BLUE } from '@/lib/theme'

const RESEND_COOLDOWN_SECONDS = 45

// ---------------- ESQUECI MINHA SENHA ----------------
// Continuação do LoginDialog (app/page.js) — três passos contra o backend (ver
// backend/src/routes/auth.js): request identifica a conta e diz qual verificação pedir ("totp" para
// administrador, "sms" para atleta/gestor); verify troca o código pela prova por um reset_token de
// uso único; reset troca a senha de verdade. O reset_token nunca é mostrado, só guardado em memória
// entre os passos — o mesmo motivo de backend nunca reexibir um segredo TOTP depois de gerado.
export default function ForgotPasswordDialog({ open, onOpenChange, onBackToLogin }) {
  // step: 'request' | 'verify' | 'reset' | 'done'
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState(null) // 'totp' | 'sms'
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const emailRef = useRef(null)
  const codeRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)

  const reset = () => {
    setStep('request')
    setEmail('')
    setMethod(null)
    setCode('')
    setTotp('')
    setResetToken('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setResendCooldown(0)
  }

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    const timer = setInterval(() => {
      setResendCooldown((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer)
          return 0
        }
        return seconds - 1
      })
    }, 1000)
  }

  const requestCode = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await api('/auth/forgot-password/request', { method: 'POST', body: { email } })
      setMethod(result.method)
      setStep('verify')
      startCooldown()
    } catch (e) {
      setError(e.message)
      emailRef.current?.focus()
      toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    if (resendCooldown > 0 || method !== 'sms') return
    setBusy(true)
    try {
      await api('/auth/forgot-password/request', { method: 'POST', body: { email } })
      toastSuccess('Código reenviado por SMS.')
      startCooldown()
    } catch (e) {
      toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const verifyCode = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await api('/auth/forgot-password/verify', {
        method: 'POST',
        body: { email, ...(method === 'totp' ? { totp } : { code }) },
      })
      setResetToken(result.reset_token)
      setStep('reset')
    } catch (e) {
      setError(e.message)
      codeRef.current?.focus()
      toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const passwordValid = password.length >= 12 && password === confirmPassword

  const resetPassword = async () => {
    setError('')
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      confirmRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await api('/auth/forgot-password/reset', { method: 'POST', body: { reset_token: resetToken, password } })
      setStep('done')
      toastSuccess('Senha redefinida com sucesso.')
    } catch (e) {
      setError(e.message)
      passwordRef.current?.focus()
      toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const backToLogin = () => {
    onOpenChange(false)
    reset()
    onBackToLogin?.()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="sm:max-w-md">
        {step === 'request' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={backToLogin}
                  aria-label="Voltar para o login"
                  className="-ml-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle>Recuperar acesso</DialogTitle>
              </div>
              <DialogDescription>
                Informe o e-mail da sua conta. Identificamos o tipo de acesso e pedimos a verificação correta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {error && <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  ref={emailRef}
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'forgot-email-error' : 'forgot-email-hint'}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && email && !busy) requestCode() }}
                />
                <p id="forgot-email-hint" className="text-xs text-muted-foreground">
                  Usaremos este e-mail apenas para localizar sua conta.
                </p>
              </div>
              <Button className="w-full text-white border-0" style={{ background: BLUE }} onClick={requestCode} disabled={busy || !email}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Continuar
              </Button>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStep('request'); setCode(''); setTotp(''); setError('') }}
                  aria-label="Usar outro e-mail"
                  className="-ml-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle className="flex-1">Verificar identidade</DialogTitle>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: method === 'totp' ? '#1E1B4B' : BLUE }}>
                  {method === 'totp' ? <ShieldCheck className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                  {method === 'totp' ? 'Administrador' : 'Atleta / Gestor'}
                </span>
              </div>
              <DialogDescription>
                {method === 'totp'
                  ? 'Insira o código de 6 dígitos do seu app autenticador.'
                  : 'Insira o código de 6 dígitos enviado por SMS para o celular cadastrado nesta conta.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {error && <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="forgot-code">{method === 'totp' ? 'Código do autenticador' : 'Código recebido por SMS'}</Label>
                <Input
                  ref={codeRef}
                  id="forgot-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={method === 'totp' ? totp : code}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'forgot-code-error' : undefined}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    if (method === 'totp') setTotp(digits); else setCode(digits)
                    setError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !busy) verifyCode() }}
                />
                {method === 'sms' && (
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={busy || resendCooldown > 0}
                    className="text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60 enabled:underline enabled:underline-offset-2"
                    style={resendCooldown > 0 ? undefined : { color: BLUE }}
                  >
                    {resendCooldown > 0 ? `Reenviar código em 00:${String(resendCooldown).padStart(2, '0')}` : 'Reenviar código'}
                  </button>
                )}
              </div>
              <Button
                className="w-full text-white border-0"
                style={{ background: BLUE }}
                onClick={verifyCode}
                disabled={busy || (method === 'totp' ? totp.length !== 6 : code.length !== 6)}
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Confirmar código
              </Button>
            </div>
          </>
        )}

        {step === 'reset' && (
          <>
            <DialogHeader>
              <DialogTitle>Nova senha</DialogTitle>
              <DialogDescription>Identidade confirmada. Crie uma nova senha com no mínimo 12 caracteres.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {error && <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="space-y-2">
                <Label htmlFor="forgot-new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="forgot-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    value={password}
                    aria-describedby="forgot-new-password-hint"
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p id="forgot-new-password-hint" className={`flex items-center gap-1.5 text-xs ${password.length >= 12 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {password.length >= 12 ? <Check className="h-3 w-3" /> : null} Mínimo de 12 caracteres
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forgot-confirm-password">Confirmar nova senha</Label>
                <Input
                  ref={confirmRef}
                  id="forgot-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={passwordsMismatch}
                  aria-describedby={passwordsMismatch ? 'forgot-confirm-password-error' : undefined}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && passwordValid && !busy) resetPassword() }}
                />
                {passwordsMismatch && <p id="forgot-confirm-password-error" role="alert" className="text-xs text-red-600">As senhas não coincidem.</p>}
              </div>
              <Button className="w-full text-white border-0" style={{ background: BLUE }} onClick={resetPassword} disabled={busy || !passwordValid}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Redefinir senha
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader className="items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#eff6ff' }}>
                <CheckCircle2 className="h-7 w-7" style={{ color: BLUE }} />
              </div>
              <DialogTitle>Senha redefinida com sucesso</DialogTitle>
              <DialogDescription>Sua senha foi alterada. Você já pode entrar com a nova senha.</DialogDescription>
            </DialogHeader>
            <Button className="w-full text-white border-0" style={{ background: BLUE }} onClick={backToLogin}>
              Voltar para o login
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
