'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Volleyball, UserPlus } from 'lucide-react'
import { api } from '@/lib/lvjApi'
import { toastError } from '@/lib/toast'
import { formatRg } from '@/lib/athlete'
import { BLUE, RED } from '@/lib/theme'

// PERFORMANCE (varredura): extraído de app/page.js pra dar import próprio — carregado só depois do
// primeiro clique em "Entrar" (ver loginEverOpened em page.js), mesmo padrão já usado pro
// GestorPanel. Antes disso, nada aqui (Tabs, os dois formulários, as duas chamadas de API) entrava
// no bundle inicial da home, a rota mais visitada do site.
export default function LoginDialog({ open, onOpenChange, onAuthed, onForgotPassword }) {
  const [tab, setTab] = useState('senha')

  // Password
  // A aba "Entrar" agora é o padrão e é compartilhada por gestor e admin — não faz mais
  // sentido pré-preencher com o e-mail do admin, já que todo gestor cai nela primeiro.
  const [pwEmail, setPwEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pwTotp, setPwTotp] = useState('')
  const [requiresTotp, setRequiresTotp] = useState(false)

  // Register
  const [reg, setReg] = useState({ name: '', email: '', phone: '', rg: '', password: '', consent: false })

  const [loading, setLoading] = useState(false)
  // ACESSIBILIDADE (varredura, item A12): o erro de login/cadastro só aparecia num toast — quem usa
  // teclado ou leitor de tela não tinha o foco movido de volta para corrigir, nem o campo marcado
  // como inválido. pwEmailRef/registerEmailRef abaixo são o alvo do foco quando a chamada falha.
  const [loginInvalid, setLoginInvalid] = useState(false)
  const [registerInvalid, setRegisterInvalid] = useState(false)
  const pwEmailRef = useRef(null)
  const registerEmailRef = useRef(null)

  const loginPw = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/login-password', { method: 'POST', body: { email: pwEmail, password: pw, ...(pwTotp ? { totp: pwTotp } : {}) } })
      setLoginInvalid(false)
      onAuthed(d.user)
    } catch (e) {
      if (e.code === 'TOTP_REQUIRED') setRequiresTotp(true)
      else { setLoginInvalid(true); pwEmailRef.current?.focus() }
      toastError(e.message)
    } finally {
      setLoading(false)
    }
  }
  const doRegister = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/register', { method: 'POST', body: reg })
      setRegisterInvalid(false)
      onAuthed(d.user)
    } catch (e) {
      setRegisterInvalid(true)
      registerEmailRef.current?.focus()
      toastError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volleyball className="h-5 w-5" style={{ color: BLUE }} /> Acesso LVJ
          </DialogTitle>
          <DialogDescription>
            Gestores podem entrar ou criar uma conta para inscrever a equipe. Atletas devem usar o cadastro público, disponível após a aprovação da equipe.
          </DialogDescription>
          <a href="/cadastro-atleta" className="text-sm font-medium text-primary underline underline-offset-4">
            Sou atleta: cadastrar minha conta
          </a>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="senha">Entrar</TabsTrigger>
            <TabsTrigger value="cadastro">Cadastrar gestor</TabsTrigger>
          </TabsList>

          <TabsContent value="senha" className="space-y-3 pt-2">
            <div>
              <Label htmlFor="login-password-email">E-mail</Label>
              <Input ref={pwEmailRef} id="login-password-email" type="email" autoComplete="email" value={pwEmail} aria-invalid={loginInvalid} aria-describedby={loginInvalid ? 'login-password-error' : undefined} onChange={(e) => { setPwEmail(e.target.value); setLoginInvalid(false) }} />
            </div>
            <div>
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" type="password" autoComplete="current-password" value={pw} aria-invalid={loginInvalid} aria-describedby={loginInvalid ? 'login-password-error' : undefined} onChange={(e) => { setPw(e.target.value); setLoginInvalid(false) }} />
            </div>
            {loginInvalid && <p id="login-password-error" role="alert" className="text-xs text-red-600">E-mail ou senha inválidos.</p>}
            <div className="flex justify-end">
              <button type="button" onClick={onForgotPassword} className="text-sm font-medium underline underline-offset-4" style={{ color: BLUE }}>
                Esqueci minha senha?
              </button>
            </div>
            {(requiresTotp || pwTotp) && (
              <div>
                <Label htmlFor="login-password-totp">Código 2FA do administrador</Label>
                <Input id="login-password-totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pwTotp} onChange={(e) => setPwTotp(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
              </div>
            )}
            <Button className="w-full text-white border-0" style={{ background: BLUE }} onClick={loginPw} disabled={loading}>
              Entrar
            </Button>
          </TabsContent>

          <TabsContent value="cadastro" className="space-y-3 pt-2">
            <div>
              <Label htmlFor="manager-register-name">Nome</Label>
              <Input id="manager-register-name" autoComplete="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="manager-register-email">E-mail (login)</Label>
              <Input ref={registerEmailRef} id="manager-register-email" type="email" autoComplete="email" value={reg.email} aria-invalid={registerInvalid} aria-describedby={registerInvalid ? 'manager-register-error' : undefined} onChange={(e) => { setReg({ ...reg, email: e.target.value }); setRegisterInvalid(false) }} />
            </div>
            {registerInvalid && <p id="manager-register-error" role="alert" className="text-xs text-red-600">Não foi possível concluir o cadastro — confira os dados acima.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="manager-register-phone">Celular</Label>
                <Input id="manager-register-phone" type="tel" autoComplete="tel" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} placeholder="(11) 90000-0000" />
              </div>
              <div>
                <Label htmlFor="manager-register-rg">RG</Label>
                <Input id="manager-register-rg" inputMode="text" autoComplete="off" value={reg.rg} onChange={(e) => setReg({ ...reg, rg: formatRg(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label htmlFor="manager-register-password">Senha (mínimo de 12 caracteres)</Label>
              <Input id="manager-register-password" type="password" autoComplete="new-password" minLength={12} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
            </div>
            {/* LGPD (varredura, item L1): o texto citava "a política de privacidade" sem link para ela;
                agora linka a política e os termos, que já têm conteúdo real (antes eram páginas vazias). */}
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input id="manager-register-consent" type="checkbox" checked={reg.consent} onChange={(e) => setReg({ ...reg, consent: e.target.checked })} />
              <span>Consinto com o tratamento dos meus dados para gestão da liga, conforme a <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link> e os <Link className="underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>.</span>
            </label>
            <Button className="w-full text-white border-0" style={{ background: RED }} onClick={doRegister} disabled={loading || !reg.name || !reg.email || reg.password.length < 12 || !reg.consent}>
              <UserPlus className="h-4 w-4 mr-2" /> Criar conta de Gestor
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
