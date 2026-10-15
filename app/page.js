'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import {
  Bell,
  Volleyball,
  Trophy,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  CheckCircle2,
  XCircle,
  Mail,
  ClipboardList,
  ShieldCheck,
  Menu,
  UserPlus,
  Plus,
} from 'lucide-react'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { formatCpf, isValidCpf } from '@/lib/athlete'

const PURPLE = '#6D28D9'
const ORANGE = '#F97316'
const DARKBLUE = '#0F172A'

const HERO = 'https://images.unsplash.com/photo-1547347298-4074fc3086f0'
const IMG_COURT = 'https://images.unsplash.com/photo-1666901356149-93f2eb3ba5a2'
const IMG_ACTION1 = 'https://images.unsplash.com/photo-1567880325673-ccc01edca61c'
const IMG_ARENA = 'https://images.unsplash.com/photo-1771909713106-86b9a412964a'

// ============================================================================
// Root App
// ============================================================================
function App() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [myTeam, setMyTeam] = useState(null)
  const [categories, setCategories] = useState(CATEGORY_FALLBACK)
  const [loginOpen, setLoginOpen] = useState(false)
  const [booting, setBooting] = useState(true)

  const loadMe = useCallback(async () => {
    try {
      const { user, team } = await api('/auth/me')
      setToken('cookie-session')
      setUser(user)
      setMyTeam(team)
    } catch {
      setToken(null)
      setUser(null)
      setMyTeam(null)
    }
  }, [])

  useEffect(() => {
    api('/categories').then((d) => setCategories(d.categories || CATEGORY_FALLBACK)).catch(() => {})
    loadMe().finally(() => setBooting(false))
  }, [loadMe])

  useEffect(() => {
    const authReason = new URLSearchParams(window.location.search).get('auth')
    if (authReason === 'required') setLoginOpen(true)
    if (authReason === 'forbidden') toast.error('Seu perfil não tem permissão para acessar essa área.')
  }, [])

  const onAuthed = (authenticatedUser, redirectTo) => {
    setToken('cookie-session')
    setUser(authenticatedUser)
    setLoginOpen(false)
    loadMe()
    if (redirectTo) router.push(redirectTo)
    toast.success(`Bem-vindo(a), ${authenticatedUser.name}!`)
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', token })
    } catch {}
    setToken(null)
    setUser(null)
    setMyTeam(null)
    toast('Sessão encerrada')
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] text-white">
        <Volleyball className="h-8 w-8 animate-spin" style={{ color: ORANGE }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      <TopNav
        user={user}
        token={token}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={logout}
      />
      {user?.role === 'admin' ? (
        <AdminPanel token={token} categories={categories} />
      ) : user?.role === 'gestor' ? (
        <GestorPanel token={token} categories={categories} user={user} myTeam={myTeam} refreshMe={() => loadMe(token)} />
      ) : user?.role === 'atleta' ? (
        <AthletePanel user={user} />
      ) : (
        <PublicSite categories={categories} onLoginClick={() => setLoginOpen(true)} />
      )}
      <Footer />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onAuthed={onAuthed} />
    </div>
  )
}

// ============================================================================
// Top Navigation
// ============================================================================
function TopNav({ user, token, onLoginClick, onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10" style={{ background: DARKBLUE }}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${PURPLE}, ${ORANGE})` }}
          >
            <Volleyball className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight">LVJ</div>
            <div className="text-[10px] text-slate-300 -mt-0.5">Liga de Voleibol Jundiaí</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link href="/admin/aprovacoes" className="hidden text-sm text-slate-200 hover:text-white sm:inline">
                  Aprovações
                </Link>
              )}
              {user.role === 'gestor' && (
                <>
                  <Link href="/cadastro-atleta" className="hidden text-sm text-slate-200 hover:text-white sm:inline">
                    Cadastrar atleta
                  </Link>
                  <Link href="/gestor/aprovar-atletas" className="hidden text-sm text-slate-200 hover:text-white sm:inline">
                    Aprovar atletas
                  </Link>
                </>
              )}
              {user.role === 'atleta' && (
                <Link href="/atleta/jogos" className="hidden text-sm text-slate-200 hover:text-white sm:inline">
                  Jogos e frequência
                </Link>
              )}
              <Badge
                className="hidden sm:inline-flex text-white border-0"
                style={{ background: user.role === 'admin' ? PURPLE : ORANGE }}
              >
                {user.role === 'admin' ? 'Administrador' : user.role === 'atleta' ? 'Atleta' : 'Gestor de Equipe'}
              </Badge>
              <span className="hidden sm:block text-sm text-slate-200">{user.name}</span>
              <Button size="sm" variant="secondary" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onLoginClick}
              className="text-white border-0"
              style={{ background: ORANGE }}
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function AthletePanel({ user }) {
  return (
    <main className="container py-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Olá, {user.name}</CardTitle>
          <CardDescription>Acompanhe seus jogos, frequência e declarações de participação.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="text-white" style={{ background: PURPLE }}>
            <Link href="/atleta/jogos"><CalendarDays className="mr-2 h-4 w-4" /> Abrir jogos e frequência</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

// ============================================================================
// PUBLIC SITE
// ============================================================================
function PublicSite({ categories, onLoginClick }) {
  const [category, setCategory] = useState(categories[0])
  const [standings, setStandings] = useState([])
  const [matches, setMatches] = useState([])
  const [sponsors, setSponsors] = useState([])

  useEffect(() => {
    api('/sponsors').then((d) => setSponsors(d.sponsors || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!category) return
    api(`/standings?category=${encodeURIComponent(category)}`)
      .then((d) => setStandings(d.standings || []))
      .catch(() => {})
    api(`/matches?category=${encodeURIComponent(category)}`)
      .then((d) => setMatches(d.matches || []))
      .catch(() => {})
  }, [category])

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: DARKBLUE }}>
        <img src={HERO} alt="Vôlei" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(120deg, ${DARKBLUE}ee, ${PURPLE}aa)` }}
        />
        <div className="container relative py-20 md:py-28 text-white">
          <Badge className="mb-4 border-0 text-white" style={{ background: ORANGE }}>
            Temporada 2025
          </Badge>
          <h1 className="max-w-2xl text-4xl md:text-6xl font-extrabold leading-tight">
            A casa do vôlei em <span style={{ color: ORANGE }}>Jundiaí</span>
          </h1>
          <p className="mt-4 max-w-xl text-slate-200 text-lg">
            Classificação em tempo real, agenda de jogos, gestão de equipes e atletas. Tudo em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onLoginClick} className="text-white border-0" style={{ background: ORANGE }}>
              Inscrever minha equipe
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20"
              onClick={() => document.getElementById('classificacao')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Ver classificação
            </Button>
          </div>
        </div>
      </section>

      {/* SPONSOR STRIP */}
      <section className="border-y bg-white">
        <div className="container py-6">
          <p className="text-center text-xs uppercase tracking-widest text-slate-400 mb-4">
            Patrocinadores oficiais
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {sponsors.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border px-5 py-3 shadow-sm"
                style={{ borderColor: '#e2e8f0' }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white text-xs font-bold"
                  style={{ background: PURPLE }}
                >
                  {s.name.charAt(0)}
                </div>
                <span className="font-semibold text-slate-700">{s.name}</span>
                <Badge variant="outline" className="ml-1 text-[10px] capitalize">
                  {s.tier}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY SELECT */}
      <section id="classificacao" className="container py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-extrabold" style={{ color: DARKBLUE }}>
              Classificação
            </h2>
            <p className="text-slate-500">Tabela calculada automaticamente pelo Motor de Regras da liga.</p>
          </div>
          <div className="w-full md:w-72">
            <Label className="text-xs text-slate-500">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="text-white" style={{ background: `linear-gradient(90deg, ${PURPLE}, ${DARKBLUE})` }}>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: ORANGE }} /> {category}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <StandingsTable standings={standings} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Sponsor highlight box next to standings */}
            <Card className="overflow-hidden border-2" style={{ borderColor: ORANGE }}>
              <div className="relative h-28">
                <img src={IMG_COURT} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${PURPLE}bb` }}>
                  <span className="text-white font-bold text-lg">Espaço Patrocinador</span>
                </div>
              </div>
              <CardContent className="py-4 text-center text-sm text-slate-600">
                Anuncie sua marca aqui e apoie o vôlei de Jundiaí.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" style={{ color: PURPLE }} /> Próximos jogos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {matches.filter((m) => m.status === 'scheduled').slice(0, 5).map((m) => (
                  <div key={m.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-semibold">
                      {m.home_name} <span className="text-slate-400">x</span> {m.away_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}
                    </div>
                  </div>
                ))}
                {matches.filter((m) => m.status === 'scheduled').length === 0 && (
                  <p className="text-sm text-slate-400">Nenhum jogo agendado.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* RESULTS / AGENDA */}
      <section className="bg-white border-t">
        <div className="container py-12">
          <h2 className="text-2xl font-extrabold mb-6" style={{ color: DARKBLUE }}>
            Últimos resultados
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {matches.filter((m) => m.status === 'finished').slice(0, 6).map((m) => (
              <MatchResultCard key={m.id} m={m} />
            ))}
            {matches.filter((m) => m.status === 'finished').length === 0 && (
              <p className="text-sm text-slate-400">Ainda não há resultados registrados.</p>
            )}
          </div>
        </div>
      </section>

      {/* Community / sponsor banner */}
      <section className="relative">
        <img src={IMG_ARENA} alt="" className="h-64 w-full object-cover" />
        <div className="absolute inset-0 flex items-center" style={{ background: `${DARKBLUE}cc` }}>
          <div className="container text-white">
            <h3 className="text-3xl font-extrabold max-w-lg">Faça parte da maior liga de vôlei da região</h3>
            <Button className="mt-4 text-white border-0" style={{ background: ORANGE }} onClick={onLoginClick}>
              Cadastrar equipe
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function StandingsTable({ standings }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Equipe</TableHead>
          <TableHead className="text-center">Pts</TableHead>
          <TableHead className="text-center">J</TableHead>
          <TableHead className="text-center">V</TableHead>
          <TableHead className="text-center">D</TableHead>
          <TableHead className="text-center hidden sm:table-cell">Sets</TableHead>
          <TableHead className="text-center hidden md:table-cell">Raz.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s) => (
          <TableRow key={s.team_id}>
            <TableCell>
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: s.position <= 4 ? ORANGE : '#94a3b8' }}
              >
                {s.position}
              </span>
            </TableCell>
            <TableCell className="font-semibold">{s.name}</TableCell>
            <TableCell className="text-center font-bold" style={{ color: PURPLE }}>
              {s.points}
            </TableCell>
            <TableCell className="text-center">{s.played}</TableCell>
            <TableCell className="text-center">{s.wins}</TableCell>
            <TableCell className="text-center">{s.losses}</TableCell>
            <TableCell className="text-center hidden sm:table-cell text-slate-500">
              {s.sets_won}/{s.sets_lost}
            </TableCell>
            <TableCell className="text-center hidden md:table-cell text-slate-500">{s.sets_ratio}</TableCell>
          </TableRow>
        ))}
        {standings.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-slate-400 py-8">
              Nenhuma equipe aprovada nesta categoria ainda.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function MatchResultCard({ m }) {
  const hs = (m.sets || []).filter((s) => s.home > s.away).length
  const as = (m.sets || []).filter((s) => s.away > s.home).length
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-slate-400 mb-2">
        {m.category} {m.round ? `• ${m.round}` : ''}
      </div>
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${hs > as ? 'text-slate-900' : 'text-slate-400'}`}>{m.home_name}</span>
        <span className="mx-2 font-extrabold text-lg" style={{ color: PURPLE }}>
          {hs} - {as}
        </span>
        <span className={`font-semibold text-right ${as > hs ? 'text-slate-900' : 'text-slate-400'}`}>{m.away_name}</span>
      </div>
      <div className="mt-2 flex gap-1 flex-wrap">
        {(m.sets || []).map((s, i) => (
          <span key={i} className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            {s.home}-{s.away}
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// LOGIN DIALOG
// ============================================================================
function LoginDialog({ open, onOpenChange, onAuthed }) {
  const [role, setRole] = useState('gestor')
  const [mode, setMode] = useState('access')
  const [loginMethod, setLoginMethod] = useState('password')
  const [login, setLogin] = useState({ email: '', password: '', totp: '', code: '' })
  const [otpSent, setOtpSent] = useState(false)
  const [requiresTotp, setRequiresTotp] = useState(false)
  const [reg, setReg] = useState({ name: '', email: '', phone: '', cpf: '', password: '' })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [sensitiveConsent, setSensitiveConsent] = useState(false)

  const [loading, setLoading] = useState(false)
  const optionalCpfValid = !reg.cpf.trim() || isValidCpf(reg.cpf)

  const selectRole = (selectedRole) => {
    setRole(selectedRole)
    setMode('access')
    setLoginMethod('password')
    setOtpSent(false)
    setRequiresTotp(false)
  }

  const requestOtp = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/otp/request', { method: 'POST', body: { email: login.email } })
      setOtpSent(true)
      toast.success(d.message || 'Se a conta existir, um código será enviado por e-mail.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  const verifyOtp = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/otp/verify', { method: 'POST', body: { email: login.email, code: login.code } })
      await acceptRoleSession(d.user)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  const loginPw = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/login-password', {
        method: 'POST',
        body: { email: login.email, password: login.password, ...(login.totp ? { totp: login.totp } : {}) },
      })
      await acceptRoleSession(d.user)
    } catch (e) {
      if (role === 'admin' && e.code === 'TOTP_REQUIRED') setRequiresTotp(true)
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  const doRegister = async () => {
    setLoading(true)
    try {
      const endpoint = role === 'atleta' ? '/auth/register-athlete' : '/auth/register'
      const registration = {
        name: reg.name.trim(),
        email: reg.email.trim(),
        phone: reg.phone.trim(),
        password: reg.password,
        consent: termsAccepted && sensitiveConsent,
      }
      if (role === 'gestor' && reg.cpf.trim()) registration.cpf = reg.cpf.trim()
      const d = await api(endpoint, {
        method: 'POST',
        body: registration,
      })
      onAuthed(d.user, role === 'atleta' ? '/cadastro-atleta' : undefined)
      toast.success(role === 'atleta'
        ? 'Conta criada. Agora complete seus dados esportivos e selecione uma equipe aprovada.'
        : 'Conta de gestor criada. Cadastre sua equipe para solicitar aprovação.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function acceptRoleSession(authenticatedUser) {
    if (authenticatedUser.role !== role) {
      await api('/auth/logout', { method: 'POST' })
      throw new Error(`Esta conta é de ${authenticatedUser.role === 'admin' ? 'Administrador' : authenticatedUser.role === 'gestor' ? 'Gestor de Equipe' : 'Atleta'}. Selecione a aba correspondente.`)
    }
    const athleteProfile = role === 'atleta' ? await api('/athletes/me') : null
    const redirectTo = athleteProfile && athleteProfile.athletes.length === 0 ? '/cadastro-atleta' : undefined
    onAuthed(authenticatedUser, redirectTo)
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setOtpSent(false)
    setRequiresTotp(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volleyball className="h-5 w-5" style={{ color: PURPLE }} /> Acesso LVJ
          </DialogTitle>
          <DialogDescription>Escolha seu perfil para acessar ou criar uma conta.</DialogDescription>
        </DialogHeader>

        <Tabs value={role} onValueChange={selectRole}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="admin">Painel Administrativo</TabsTrigger>
            <TabsTrigger value="gestor">Gestor de Equipe</TabsTrigger>
            <TabsTrigger value="atleta">Atletas</TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Acesso exclusivo da conta administrativa provisionada no ambiente do servidor (.env). O cadastro público de administradores não é permitido.
            </p>
            <RoleAccessForm role="admin" login={login} setLogin={setLogin} loading={loading}
              requiresTotp={requiresTotp} onSubmit={loginPw} />
          </TabsContent>

          {['gestor', 'atleta'].map((selectedRole) => (
            <TabsContent key={selectedRole} value={selectedRole} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={mode === 'access' ? 'default' : 'outline'} onClick={() => switchMode('access')}>
                  Acesso para {selectedRole === 'gestor' ? 'gestor' : 'atleta'}
                </Button>
                <Button type="button" variant={mode === 'register' ? 'default' : 'outline'} onClick={() => switchMode('register')}>
                  Cadastro para {selectedRole === 'gestor' ? 'gestores' : 'atletas'}
                </Button>
              </div>
              {mode === 'access' ? (
                <>
                  <RoleAccessForm role={selectedRole} login={login} setLogin={setLogin} loading={loading}
                    requiresTotp={false} onSubmit={loginPw} />
                  <div className="border-t pt-3">
                    {loginMethod === 'password' ? (
                      <Button type="button" variant="link" className="h-auto p-0 text-sm"
                        onClick={() => { setLoginMethod('otp'); setOtpSent(false) }}>
                        Entrar com código enviado por e-mail
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`${selectedRole}-otp-email`}>E-mail</Label>
                          <Input id={`${selectedRole}-otp-email`} type="email" autoComplete="email"
                            value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
                        </div>
                        {otpSent && (
                          <div className="space-y-2">
                            <Label htmlFor={`${selectedRole}-otp-code`}>Código de 6 dígitos</Label>
                            <Input id={`${selectedRole}-otp-code`} inputMode="numeric" maxLength={6}
                              value={login.code} onChange={(event) => setLogin({ ...login, code: event.target.value.replace(/\D/g, '') })} />
                          </div>
                        )}
                        <Button type="button" className="w-full" onClick={otpSent ? verifyOtp : requestOtp}
                          disabled={loading || !login.email || (otpSent && login.code.length !== 6)}>
                          {otpSent ? 'Validar código e entrar' : 'Enviar código por e-mail'}
                        </Button>
                        <Button type="button" variant="link" className="h-auto p-0 text-sm"
                          onClick={() => { setLoginMethod('password'); setOtpSent(false) }}>
                          Entrar com senha
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${selectedRole}-register-name`}>Nome completo</Label>
                    <Input id={`${selectedRole}-register-name`} autoComplete="name" value={reg.name}
                      onChange={(event) => setReg({ ...reg, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${selectedRole}-register-email`}>E-mail (login)</Label>
                    <Input id={`${selectedRole}-register-email`} type="email" autoComplete="email" value={reg.email}
                      onChange={(event) => setReg({ ...reg, email: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${selectedRole}-register-phone`}>Celular (opcional)</Label>
                    <Input id={`${selectedRole}-register-phone`} autoComplete="tel" value={reg.phone}
                      onChange={(event) => setReg({ ...reg, phone: event.target.value })} />
                  </div>
                  {selectedRole === 'gestor' && (
                    <div className="space-y-2">
                      <Label htmlFor="gestor-register-cpf">CPF (opcional)</Label>
                      <Input id="gestor-register-cpf" inputMode="numeric" value={reg.cpf}
                          onChange={(event) => setReg({ ...reg, cpf: formatCpf(event.target.value) })}
                          aria-invalid={!optionalCpfValid} />
                        {!optionalCpfValid && <p className="text-sm text-destructive">CPF inválido.</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`${selectedRole}-register-password`}>Senha (mínimo de 12 caracteres)</Label>
                    <Input id={`${selectedRole}-register-password`} type="password" autoComplete="new-password"
                      value={reg.password} onChange={(event) => setReg({ ...reg, password: event.target.value })} />
                  </div>
                  <ConsentFields termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted}
                    sensitiveConsent={sensitiveConsent} setSensitiveConsent={setSensitiveConsent} />
                  <Button type="button" className="w-full text-white border-0" style={{ background: ORANGE }}
                    onClick={doRegister}
                    disabled={loading || reg.name.trim().length < 2 || !reg.email || reg.password.length < 12 || !termsAccepted || !sensitiveConsent || (selectedRole === 'gestor' && !optionalCpfValid)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar conta de {selectedRole === 'gestor' ? 'Gestor' : 'Atleta'}
                  </Button>
                  {selectedRole === 'atleta' && (
                    <p className="text-xs text-muted-foreground">
                      Após criar a conta, você completará seus dados esportivos, escolherá uma equipe aprovada e enviará o cadastro para aprovação do gestor.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function RoleAccessForm({ role, login, setLogin, loading, requiresTotp, onSubmit }) {
  const name = role === 'admin' ? 'Administrador' : role === 'gestor' ? 'Gestor de equipe' : 'Atleta'
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${role}-login-email`}>E-mail</Label>
        <Input id={`${role}-login-email`} type="email" autoComplete="username" value={login.email}
          onChange={(event) => setLogin({ ...login, email: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${role}-login-password`}>Senha</Label>
        <Input id={`${role}-login-password`} type="password" autoComplete="current-password" value={login.password}
          onChange={(event) => setLogin({ ...login, password: event.target.value })} />
      </div>
      {(role === 'admin' && (requiresTotp || login.totp)) && (
        <div className="space-y-2">
          <Label htmlFor="admin-login-totp">Código 2FA do administrador</Label>
          <Input id="admin-login-totp" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
            value={login.totp} onChange={(event) => setLogin({ ...login, totp: event.target.value.replace(/\D/g, '') })}
            placeholder="000000" />
        </div>
      )}
      <Button type="button" className="w-full text-white border-0" style={{ background: PURPLE }}
        onClick={onSubmit} disabled={loading || !login.email || !login.password || (role === 'admin' && requiresTotp && login.totp.length !== 6)}>
        Entrar como {name}
      </Button>
    </div>
  )
}

function ConsentFields({ termsAccepted, setTermsAccepted, sensitiveConsent, setSensitiveConsent }) {
  return (
    <>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
        <span>Aceito os <Link href="/termos-de-uso" className="text-violet-700 underline">Termos de Uso</Link>.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={sensitiveConsent} onChange={(event) => setSensitiveConsent(event.target.checked)} required />
        <span>Consinto com o tratamento dos meus dados pessoais e sensíveis, conforme a <Link href="/privacidade" className="text-violet-700 underline">Política de Privacidade</Link>.</span>
      </label>
    </>
  )
}

// ============================================================================
// ADMIN PANEL
// ============================================================================
function AdminPanel({ token, categories }) {
  const [notif, setNotif] = useState({ pending_teams: 0, pending_athletes: 0, unread: 0, items: [] })
  const [stats, setStats] = useState({})

  const loadNotif = useCallback(() => {
    api('/admin/notifications', { token }).then(setNotif).catch(() => {})
    api('/admin/stats', { token }).then(setStats).catch(() => {})
  }, [token])

  useEffect(() => {
    loadNotif()
    const t = setInterval(loadNotif, 15000)
    return () => clearInterval(t)
  }, [loadNotif])

  return (
    <main className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: DARKBLUE }}>
            <ShieldCheck className="h-6 w-6" style={{ color: PURPLE }} /> Painel Administrativo
          </h1>
          <p className="text-slate-500 text-sm">Gestão completa da Liga de Voleibol Jundiaí</p>
        </div>
        <NotificationBell notif={notif} token={token} reload={loadNotif} />
      </div>
      <div className="mb-6">
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/aprovacoes"><ShieldCheck className="mr-2 h-4 w-4" /> Aprovações e datas</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Equipes" value={stats.teams || 0} icon={Users} color={PURPLE} />
        <StatCard label="Atletas" value={stats.athletes || 0} icon={Volleyball} color={ORANGE} />
        <StatCard label="Jogos" value={stats.matches || 0} icon={CalendarDays} color={DARKBLUE} />
        <StatCard label="Equipes pend." value={stats.pending_teams || 0} icon={ClipboardList} color="#dc2626" />
        <StatCard label="Atletas pend." value={stats.pending_athletes || 0} icon={ClipboardList} color="#dc2626" />
      </div>

      <Tabs defaultValue="equipes">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="atletas">Atletas</TabsTrigger>
          <TabsTrigger value="jogos">Jogos & Resultados</TabsTrigger>
          <TabsTrigger value="presenca">Presença</TabsTrigger>
          <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
          <TabsTrigger value="classificacao">Classificação</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
        </TabsList>

        <TabsContent value="equipes"><AdminTeams token={token} reload={loadNotif} /></TabsContent>
        <TabsContent value="atletas"><AdminAthletes token={token} reload={loadNotif} /></TabsContent>
        <TabsContent value="jogos"><AdminMatches token={token} categories={categories} /></TabsContent>
        <TabsContent value="presenca"><AdminAttendance token={token} categories={categories} /></TabsContent>
        <TabsContent value="regulamento"><RulesEngine token={token} /></TabsContent>
        <TabsContent value="classificacao"><AdminStandings token={token} categories={categories} /></TabsContent>
        <TabsContent value="emails"><AdminEmails token={token} /></TabsContent>
      </Tabs>
    </main>
  )
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: color }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-extrabold leading-none">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationBell({ notif, token, reload }) {
  const total = (notif.pending_teams || 0) + (notif.pending_athletes || 0)
  const markAll = async () => {
    await api('/admin/notifications/read-all', { method: 'POST', token })
    reload()
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: ORANGE }}
            >
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between" style={{ background: DARKBLUE }}>
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: ORANGE }} /> Central de Notificações
          </span>
          <button className="text-xs text-slate-300 hover:text-white" onClick={markAll}>
            marcar lidas
          </button>
        </div>
        <div className="p-3 space-y-2 border-b bg-orange-50">
          {notif.pending_teams > 0 && (
            <div className="text-sm text-slate-700">
              <strong>{notif.pending_teams}</strong> equipe(s) aguardando aprovação
            </div>
          )}
          {notif.pending_athletes > 0 && (
            <div className="text-sm text-slate-700">
              <strong>{notif.pending_athletes}</strong> atleta(s) aguardando liberação
            </div>
          )}
          {notif.pending_teams === 0 && notif.pending_athletes === 0 && (
            <div className="text-sm text-slate-500">Nenhuma ação pendente. Tudo em dia!</div>
          )}
        </div>
        <div className="max-h-72 overflow-auto divide-y">
          {(notif.items || []).map((i) => (
            <div key={i.id} className={`p-3 text-sm ${i.read ? 'opacity-60' : ''}`}>
              <div className="font-semibold text-slate-800">{i.title}</div>
              <div className="text-slate-500 text-xs">{i.body}</div>
              <div className="text-[10px] text-slate-400 mt-1">{new Date(i.created_at).toLocaleString('pt-BR')}</div>
            </div>
          ))}
          {(!notif.items || notif.items.length === 0) && (
            <div className="p-4 text-sm text-slate-400 text-center">Sem notificações.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AdminTeams({ token, reload }) {
  const [teams, setTeams] = useState([])
  const [rejectId, setRejectId] = useState(null)
  const [justif, setJustif] = useState('')

  const load = useCallback(() => {
    api('/admin/teams', { token }).then((d) => setTeams(d.teams || [])).catch(() => {})
  }, [token])
  useEffect(load, [load])

  const act = async (id, action, justification) => {
    try {
      await api(`/admin/teams/${id}/${action}`, { method: 'POST', token, body: { justification } })
      toast.success(action === 'approve' ? 'Equipe aprovada; e-mail colocado na fila' : 'Equipe recusada; e-mail colocado na fila')
      setRejectId(null)
      setJustif('')
      load()
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Aprovação de Equipes</CardTitle>
        <CardDescription>Aprove ou recuse. O e-mail de confirmação é enviado ao gestor pelo serviço local de e-mail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-slate-500">
                {t.category} • Gestor: {t.manager_name} ({t.manager_email})
              </div>
              {t.status === 'rejected' && t.justification && (
                <div className="text-xs text-red-500 mt-1">Motivo: {t.justification}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              {t.status === 'pending' && (
                <>
                  <Button size="sm" className="text-white border-0" style={{ background: '#16a34a' }} onClick={() => act(t.id, 'approve')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectId(t.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Recusar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-sm text-slate-400">Nenhuma equipe cadastrada.</p>}
      </CardContent>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar equipe</DialogTitle>
            <DialogDescription>Informe a justificativa que será enviada ao gestor por e-mail.</DialogDescription>
          </DialogHeader>
          <Textarea value={justif} onChange={(e) => setJustif(e.target.value)} placeholder="Ex: documentação incompleta..." />
          <Button variant="destructive" onClick={() => act(rejectId, 'reject', justif)} disabled={!justif.trim()}>
            Confirmar recusa
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function AdminAthletes({ token, reload }) {
  const [athletes, setAthletes] = useState([])
  const [rejectId, setRejectId] = useState(null)
  const [justif, setJustif] = useState('')

  const load = useCallback(() => {
    api('/admin/athletes', { token }).then((d) => setAthletes(d.athletes || [])).catch(() => {})
  }, [token])
  useEffect(load, [load])

  const act = async (id, action, justification) => {
    try {
      await api(`/admin/athletes/${id}/${action}`, { method: 'POST', token, body: { justification } })
      toast.success(action === 'approve' ? 'Atleta liberado; e-mail colocado na fila' : 'Atleta recusado; e-mail colocado na fila')
      setRejectId(null)
      setJustif('')
      load()
      reload()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Liberação de Atletas</CardTitle>
        <CardDescription>Atletas cadastrados pelos gestores. Mesmo CPF pode existir em várias categorias.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {athletes.map((a) => (
          <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">
                CPF {a.cpf} • {a.team_name} • {a.category} {a.position ? `• ${a.position}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={a.status} />
              {a.status === 'awaiting_admin' && (
                <>
                  <Button size="sm" className="text-white border-0" style={{ background: '#16a34a' }} onClick={() => act(a.id, 'approve')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Liberar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectId(a.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Recusar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {athletes.length === 0 && <p className="text-sm text-slate-400">Nenhum atleta cadastrado.</p>}
      </CardContent>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar atleta</DialogTitle>
            <DialogDescription>A justificativa será enviada ao gestor por e-mail.</DialogDescription>
          </DialogHeader>
          <Textarea value={justif} onChange={(e) => setJustif(e.target.value)} placeholder="Motivo da recusa..." />
          <Button variant="destructive" onClick={() => act(rejectId, 'reject', justif)} disabled={!justif.trim()}>
            Confirmar recusa
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Pendente', bg: '#f59e0b' },
    awaiting_manager: { label: 'Aguardando gestor', bg: '#f59e0b' },
    awaiting_admin: { label: 'Aguardando administrador', bg: '#f97316' },
    approved: { label: 'Aprovado', bg: '#16a34a' },
    rejected: { label: 'Recusado', bg: '#dc2626' },
    proposed: { label: 'Aguardando aceite', bg: '#f59e0b' },
    confirmed: { label: 'Confirmado', bg: '#16a34a' },
    scheduled: { label: 'Agendado', bg: '#16a34a' },
    cancelled: { label: 'Cancelado', bg: '#64748b' },
    finished: { label: 'Finalizado', bg: '#64748b' },
  }
  const s = map[status] || map.pending
  return (
    <Badge className="text-white border-0" style={{ background: s.bg }}>
      {s.label}
    </Badge>
  )
}

// ---------------- RULES ENGINE ----------------
function RulesEngine({ token }) {
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/rules', { token }).then((d) => setRules(d.rules)).catch(() => {})
  }, [token])

  if (!rules) return <p className="mt-4 text-slate-400">Carregando...</p>

  const setPoint = (k, v) => setRules({ ...rules, points: { ...rules.points, [k]: Number(v) } })

  const tiebreakerOptions = [
    { key: 'points', label: 'Pontos' },
    { key: 'wins', label: 'Vitórias' },
    { key: 'sets_ratio', label: 'Razão de Sets (Set Average)' },
    { key: 'points_ratio', label: 'Razão de Pontos (Point Average)' },
  ]

  const moveTiebreaker = (idx, dir) => {
    const arr = [...rules.tiebreakers]
    const ni = idx + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
    setRules({ ...rules, tiebreakers: arr })
  }

  const save = async () => {
    setSaving(true)
    try {
      const d = await api('/rules', { method: 'PUT', token, body: rules })
      setRules(d.rules)
      toast.success('Regulamento salvo! A classificação será recalculada.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pointFields = [
    ['win_3_0', 'Vitória 3x0'],
    ['win_3_1', 'Vitória 3x1'],
    ['win_3_2', 'Vitória 3x2'],
    ['loss_3_2', 'Derrota 2x3'],
    ['loss_3_1', 'Derrota 1x3'],
    ['loss_3_0', 'Derrota 0x3'],
  ]

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" style={{ color: PURPLE }} /> Motor de Regras Configuráveis
        </CardTitle>
        <CardDescription>Defina a pontuação, critérios de desempate e presença mínima. A tabela é recalculada automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold mb-3" style={{ color: DARKBLUE }}>Pontuação por resultado</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pointFields.map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={rules.points[k]} onChange={(e) => setPoint(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-3" style={{ color: DARKBLUE }}>Critérios de desempate (ordem de prioridade)</h4>
          <div className="space-y-2">
            {rules.tiebreakers.map((tb, idx) => {
              const opt = tiebreakerOptions.find((o) => o.key === tb)
              return (
                <div key={tb} className="flex items-center gap-2 rounded-lg border p-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: PURPLE }}>
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm">{opt?.label || tb}</span>
                  <Button size="sm" variant="outline" onClick={() => moveTiebreaker(idx, -1)} disabled={idx === 0}>↑</Button>
                  <Button size="sm" variant="outline" onClick={() => moveTiebreaker(idx, 1)} disabled={idx === rules.tiebreakers.length - 1}>↓</Button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="max-w-xs">
          <h4 className="font-semibold mb-3" style={{ color: DARKBLUE }}>Presença mínima para finais/mata-mata</h4>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={rules.min_attendance_percent}
              onChange={(e) => setRules({ ...rules, min_attendance_percent: Number(e.target.value) })}
            />
            <span className="text-slate-500">%</span>
          </div>
        </div>

        <Button className="text-white border-0" style={{ background: ORANGE }} onClick={save} disabled={saving}>
          Salvar Regulamento
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------------- MATCHES ----------------
function AdminMatches({ token, categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
  const [resultMatch, setResultMatch] = useState(null)
  const [sets, setSets] = useState([{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }])

  const load = useCallback(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`, { token }).then((d) => setTeams(d.teams || [])).catch(() => {})
    api(`/matches?category=${encodeURIComponent(category)}`).then((d) => setMatches(d.matches || [])).catch(() => {})
  }, [token, category])
  useEffect(load, [load])

  const create = async () => {
    if (!form.home_team_id || !form.away_team_id || form.home_team_id === form.away_team_id) {
      toast.error('Selecione duas equipes diferentes')
      return
    }
    try {
      await api('/admin/matches', { method: 'POST', token, body: form })
      toast.success('Jogo agendado')
      setForm({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const saveResult = async () => {
    const clean = sets.filter((s) => s.home !== '' && s.away !== '')
    try {
      await api(`/admin/matches/${resultMatch.id}/result`, { method: 'PUT', token, body: { sets: clean.map((s) => ({ home: Number(s.home), away: Number(s.away) })) } })
      toast.success('Resultado salvo! Classificação atualizada.')
      setResultMatch(null)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Agenda & Resultados</CardTitle>
        <CardDescription>Agende jogos e insira placares (sets). A classificação é gerada automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="w-full md:w-72">
          <Label className="text-xs">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border p-4 grid gap-3 md:grid-cols-5 items-end bg-slate-50">
          <div className="md:col-span-1">
            <Label className="text-xs">Mandante</Label>
            <Select value={form.home_team_id} onValueChange={(v) => setForm({ ...form, home_team_id: v })}>
              <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Visitante</Label>
            <Select value={form.away_team_id} onValueChange={(v) => setForm({ ...form, away_team_id: v })}>
              <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data/Hora</Label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Local / Rodada</Label>
            <Input placeholder="Ginásio / Rodada 1" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <Button className="text-white border-0" style={{ background: PURPLE }} onClick={create}>
            <Plus className="h-4 w-4 mr-1" /> Agendar
          </Button>
        </div>

        <div className="space-y-2">
          {matches.map((m) => {
            const hs = (m.sets || []).filter((s) => s.home > s.away).length
            const as = (m.sets || []).filter((s) => s.away > s.home).length
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-semibold">
                    {m.home_name} <span className="text-slate-400">x</span> {m.away_name}
                    {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: PURPLE }}>({hs}-{as})</span>}
                  </div>
                  <div className="text-xs text-slate-500">{new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  <Button size="sm" variant="outline" disabled={!['confirmed', 'scheduled', 'finished'].includes(m.status)} onClick={() => { setResultMatch(m); setSets([{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }].map((s, i) => (m.sets && m.sets[i]) ? { home: String(m.sets[i].home), away: String(m.sets[i].away) } : s)) }}>
                    Placar
                  </Button>
                </div>
              </div>
            )
          })}
          {matches.length === 0 && <p className="text-sm text-slate-400">Nenhum jogo nesta categoria.</p>}
        </div>
      </CardContent>

      <Dialog open={!!resultMatch} onOpenChange={(o) => !o && setResultMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placar por set</DialogTitle>
            <DialogDescription>{resultMatch?.home_name} x {resultMatch?.away_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-sm text-slate-500">Set {i + 1}</span>
                <Input type="number" value={s.home} onChange={(e) => { const n = [...sets]; n[i] = { ...n[i], home: e.target.value }; setSets(n) }} placeholder="0" />
                <span>x</span>
                <Input type="number" value={s.away} onChange={(e) => { const n = [...sets]; n[i] = { ...n[i], away: e.target.value }; setSets(n) }} placeholder="0" />
              </div>
            ))}
          </div>
          <Button className="text-white border-0" style={{ background: ORANGE }} onClick={saveResult}>Salvar resultado</Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------- ATTENDANCE ----------------
function AdminAttendance({ token, categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [athletes, setAthletes] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [present, setPresent] = useState({})
  const [freq, setFreq] = useState([])

  useEffect(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`, { token }).then((d) => setTeams(d.teams || [])).catch(() => {})
  }, [token, category])

  const loadTeam = useCallback((tid) => {
    setTeamId(tid)
    api('/admin/athletes?status=approved', { token }).then((d) => {
      const list = (d.athletes || []).filter((a) => a.team_id === tid)
      setAthletes(list)
      const init = {}
      list.forEach((a) => (init[a.id] = true))
      setPresent(init)
    })
    api(`/admin/attendance?team_id=${tid}`, { token }).then((d) => setFreq(d.attendance || [])).catch(() => {})
  }, [token])

  const save = async () => {
    const records = athletes.map((a) => ({ athlete_id: a.id, present: !!present[a.id] }))
    try {
      await api('/admin/attendance', { method: 'POST', token, body: { team_id: teamId, date, records } })
      toast.success('Presença registrada')
      loadTeam(teamId)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const uploadSumula = async () => {
    try {
      await api('/admin/sumula', { method: 'POST', token, body: { team_id: teamId, category, date, filename: 'sumula_digitalizada.jpg' } })
      toast.success('Súmula importada (MOCKED - sem OCR real)')
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Gestão de Presença</CardTitle>
        <CardDescription>Registro manual (nome a nome) e importação de súmula (MOCKED).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setTeamId(''); setAthletes([]) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Equipe</Label>
            <Select value={teamId} onValueChange={loadTeam}>
              <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {teamId && (
          <>
            <div className="rounded-lg border divide-y">
              {athletes.map((a) => (
                <label key={a.id} className="flex items-center justify-between p-3 cursor-pointer">
                  <span className="text-sm">{a.name} <span className="text-xs text-slate-400">CPF {a.cpf}</span></span>
                  <input type="checkbox" className="h-5 w-5" checked={!!present[a.id]} onChange={(e) => setPresent({ ...present, [a.id]: e.target.checked })} />
                </label>
              ))}
              {athletes.length === 0 && <p className="p-3 text-sm text-slate-400">Nenhum atleta aprovado nesta equipe.</p>}
            </div>
            <div className="flex gap-2">
              <Button className="text-white border-0" style={{ background: PURPLE }} onClick={save} disabled={athletes.length === 0}>Registrar presença</Button>
              <Button variant="outline" onClick={uploadSumula}><ClipboardList className="h-4 w-4 mr-1" /> Importar súmula (MOCKED)</Button>
            </div>

            {freq.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2" style={{ color: DARKBLUE }}>Frequência da equipe</h4>
                <div className="space-y-1">
                  {freq.map((f) => (
                    <div key={f.athlete_id} className="flex items-center justify-between text-sm rounded border p-2">
                      <span>{f.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500">{f.present}/{f.total_sessions} ({f.percent}%)</span>
                        <Badge className="border-0 text-white" style={{ background: f.eligible ? '#16a34a' : '#dc2626' }}>
                          {f.eligible ? 'Apto' : 'Inapto'}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AdminStandings({ token, categories }) {
  const [category, setCategory] = useState(categories[0])
  const [standings, setStandings] = useState([])
  useEffect(() => {
    api(`/standings?category=${encodeURIComponent(category)}`).then((d) => setStandings(d.standings || [])).catch(() => {})
  }, [category])
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Classificação (automática)</CardTitle>
          <div className="w-56">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0"><StandingsTable standings={standings} /></CardContent>
    </Card>
  )
}

function AdminEmails({ token }) {
  const [emails, setEmails] = useState([])
  useEffect(() => {
    api('/admin/emails', { token }).then((d) => setEmails(d.emails || [])).catch(() => {})
  }, [token])
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" style={{ color: ORANGE }} /> E-mails transacionais (MOCKED)</CardTitle>
        <CardDescription>Registro dos e-mails que seriam enviados via Resend. Plugue a chave para envio real.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {emails.map((e) => (
          <div key={e.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{e.subject}</span>
              <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
            </div>
            <div className="text-xs text-slate-500">Para: {e.to} • {new Date(e.created_at).toLocaleString('pt-BR')}</div>
            <div className="text-xs text-slate-600 mt-1" dangerouslySetInnerHTML={{ __html: e.html }} />
          </div>
        ))}
        {emails.length === 0 && <p className="text-sm text-slate-400">Nenhum e-mail enviado ainda.</p>}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// GESTOR PANEL
// ============================================================================
function GestorPanel({ token, categories, user, myTeam, refreshMe }) {
  const [team, setTeam] = useState(myTeam)
  const [teamForm, setTeamForm] = useState({ name: '', category: categories[0] })

  useEffect(() => setTeam(myTeam), [myTeam])

  const createTeam = async () => {
    try {
      const d = await api('/teams', { method: 'POST', token, body: teamForm })
      setTeam(d.team)
      toast.success('Equipe enviada para aprovação!')
      refreshMe()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1" style={{ color: DARKBLUE }}>
        <Users className="h-6 w-6" style={{ color: PURPLE }} /> Painel do Gestor
      </h1>
      <p className="text-slate-500 text-sm mb-6">Olá {user.name}, gerencie sua equipe e elenco.</p>
      {team?.status === 'approved' && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link href="/cadastro-atleta"><UserPlus className="mr-2 h-4 w-4" /> Cadastrar atleta</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/gestor/aprovar-atletas"><CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar atletas</Link></Button>
        </div>
      )}

      {!team ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Inscrever equipe</CardTitle>
            <CardDescription>Cadastre sua equipe. Após aprovação do Admin, você poderá cadastrar atletas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome da equipe</Label>
              <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={teamForm.category} onValueChange={(v) => setTeamForm({ ...teamForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="text-white border-0" style={{ background: ORANGE }} onClick={createTeam} disabled={!teamForm.name}>
              Solicitar inscrição
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{team.name}</div>
                <div className="text-sm text-slate-500">{team.category}</div>
                {team.status === 'rejected' && team.justification && (
                  <div className="text-xs text-red-500 mt-1">Motivo da recusa: {team.justification}</div>
                )}
              </div>
              <StatusBadge status={team.status} />
            </CardContent>
          </Card>

          <Tabs defaultValue="elenco">
            <TabsList>
              <TabsTrigger value="elenco">Elenco</TabsTrigger>
              <TabsTrigger value="frequencia">Frequência</TabsTrigger>
              <TabsTrigger value="classificacao">Classificação</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
            <TabsContent value="elenco"><GestorRoster token={token} team={team} /></TabsContent>
            <TabsContent value="frequencia"><GestorFrequency token={token} /></TabsContent>
            <TabsContent value="classificacao"><GestorStandings token={token} category={team.category} /></TabsContent>
            <TabsContent value="agenda"><GestorAgenda category={team.category} token={token} team={team} /></TabsContent>
          </Tabs>
        </>
      )}
    </main>
  )
}

function GestorRoster({ token, team }) {
  const [athletes, setAthletes] = useState([])
  const [form, setForm] = useState({ name: '', cpf: '', position: '', birthdate: '', email: '', photo: null, terms: false, consent: false })
  const [rejectId, setRejectId] = useState(null)
  const [justification, setJustification] = useState('')
  const cpfValid = isValidCpf(form.cpf)

  const load = useCallback(() => {
    api('/athletes/mine', { token }).then((d) => setAthletes(d.athletes || [])).catch(() => {})
  }, [token])
  useEffect(load, [load])

  const add = async () => {
    try {
      let biometry_key
      if (form.photo) {
        const upload = await api('/athletes/biometry-upload', {
          method: 'POST',
          token,
          body: { content_type: form.photo.type },
        })
        const uploadForm = new FormData()
        Object.entries(upload.uploadFields).forEach(([key, value]) => uploadForm.append(key, value))
        uploadForm.append('file', form.photo)
        const response = await fetch(upload.uploadUrl, { method: 'POST', body: uploadForm, credentials: 'omit' })
        if (!response.ok) throw new Error('Não foi possível enviar a foto para o armazenamento.')
        biometry_key = upload.key
      }
      await api('/athletes', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          cpf: form.cpf,
          position: form.position,
          birthdate: form.birthdate || undefined,
          email: form.email || undefined,
          consent: form.terms && form.consent,
          ...(biometry_key ? { biometry_key } : {}),
        },
      })
      toast.success('Atleta cadastrado e aguardando aprovação do gestor.')
      setForm({ name: '', cpf: '', position: '', birthdate: '', email: '', photo: null, terms: false, consent: false })
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const review = async (id, action, reason = '') => {
    try {
      await api(`/gestor/athletes/${id}/${action}`, { method: 'POST', token, body: { justification: reason } })
      toast.success(action === 'approve' ? 'Atleta encaminhado para aprovação final.' : 'Cadastro do atleta recusado.')
      setRejectId(null)
      setJustification('')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Elenco</CardTitle>
        <CardDescription>Os cadastros passam primeiro pela aprovação do gestor e depois pela aprovação final do administrador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {team.status === 'approved' ? (
          <div className="grid gap-3 md:grid-cols-3 items-end rounded-lg border p-4 bg-slate-50">
            <div>
              <Label className="text-xs">Nome do atleta</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} inputMode="numeric" placeholder="000.000.000-00" onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} aria-invalid={form.cpf.length > 13 && !cpfValid} />
            </div>
            <div>
              <Label className="text-xs">Posição</Label>
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                <option value="">Selecione</option>
                <option value="central">Central</option>
                <option value="ponteiro">Ponteiro</option>
                <option value="saida">Saída</option>
                <option value="levantador">Levantador</option>
                <option value="libero">Líbero</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">E-mail do atleta (opcional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Foto para biometria (máx. 5 MB)</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] || null })} />
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} />
              <span>Li e aceito os <Link href="/termos-de-uso" className="text-violet-700 underline">Termos de Uso</Link>.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600 md:col-span-2">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>Confirmo que obtive consentimento explícito do atleta (ou responsável legal) para tratar seus dados e a foto biométrica, conforme a <Link href="/privacidade" className="text-violet-700 underline">Política de Privacidade</Link>.</span>
            </label>
            <Button className="text-white border-0" style={{ background: PURPLE }} onClick={add} disabled={!form.name || !cpfValid || !form.position || !form.terms || !form.consent || (form.photo && form.photo.size > 5 * 1024 * 1024)}>
              <UserPlus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Sua equipe precisa ser aprovada pelo Admin antes de cadastrar atletas.
          </div>
        )}

        <div className="space-y-2">
          {athletes.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-500">CPF {a.cpf} {a.position ? `• ${a.position}` : ''}</div>
                {a.status === 'rejected' && a.justification && <div className="text-xs text-red-500">Motivo: {a.justification}</div>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                {a.status === 'awaiting_manager' && (
                  <>
                    <Button size="sm" onClick={() => review(a.id, 'approve')}>Aprovar</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectId(a.id)}>Recusar</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {athletes.length === 0 && <p className="text-sm text-slate-400">Nenhum atleta no elenco.</p>}
        </div>
      </CardContent>
      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar cadastro de atleta</DialogTitle>
            <DialogDescription>Informe o motivo da recusa.</DialogDescription>
          </DialogHeader>
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
          <Button variant="destructive" onClick={() => review(rejectId, 'reject', justification)} disabled={!justification.trim()}>
            Confirmar recusa
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function GestorFrequency({ token }) {
  const [data, setData] = useState({ attendance: [] })
  useEffect(() => {
    api('/attendance/mine', { token }).then(setData).catch(() => {})
  }, [token])
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Frequência (presença)</CardTitle>
        <CardDescription>Acompanhe a presença de cada atleta em relação à meta mínima da liga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(data.attendance || []).map((f) => (
          <div key={f.athlete_id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{f.name}</span>
              <Badge className="border-0 text-white" style={{ background: f.eligible ? '#16a34a' : '#dc2626' }}>
                {f.eligible ? `Apto (min ${f.min_required}%)` : `Inapto (min ${f.min_required}%)`}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.min(f.percent, 100)}%`, background: f.eligible ? '#16a34a' : ORANGE }} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{f.present}/{f.total_sessions} presenças • {f.percent}%</div>
          </div>
        ))}
        {(data.attendance || []).length === 0 && <p className="text-sm text-slate-400">Ainda não há registros de presença.</p>}
      </CardContent>
    </Card>
  )
}

function GestorStandings({ token, category }) {
  const [standings, setStandings] = useState([])
  useEffect(() => {
    api(`/standings?category=${encodeURIComponent(category)}`).then((d) => setStandings(d.standings || [])).catch(() => {})
  }, [category])
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Classificação • {category}</CardTitle></CardHeader>
      <CardContent className="p-0"><StandingsTable standings={standings} /></CardContent>
    </Card>
  )
}

function GestorAgenda({ category, token, team }) {
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState('all')
  const load = useCallback(() => {
    api(`/matches?category=${encodeURIComponent(category)}`).then((d) => setMatches(d.matches || [])).catch(() => {})
  }, [category])
  useEffect(load, [load])
  const accept = async (matchId) => {
    try {
      await api(`/gestor/matches/${matchId}/accept`, { method: 'POST', token, body: {} })
      toast.success('Aceite registrado.')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }
  const filtered = matches.filter((m) => filter === 'all' || m.status === filter)
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agenda • {category}</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="proposed">Aguardando aceite</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="scheduled">Agendados</SelectItem>
              <SelectItem value="finished">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.map((m) => {
          const hs = (m.sets || []).filter((s) => s.home > s.away).length
          const as = (m.sets || []).filter((s) => s.away > s.home).length
          return (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <div className="font-semibold">
                  {m.home_name} <span className="text-slate-400">x</span> {m.away_name}
                  {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: PURPLE }}>({hs}-{as})</span>}
                </div>
                <div className="text-xs text-slate-500">{new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                {m.status === 'proposed' && [m.home_team_id, m.away_team_id].includes(team?.id) && (
                  <Button size="sm" onClick={() => accept(m.id)}>Aceitar data</Button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-400">Nenhum jogo.</p>}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Footer with sponsors
// ============================================================================
function Footer() {
  return (
    <footer className="mt-12" style={{ background: DARKBLUE }}>
      <div className="container py-10 text-slate-300">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-white mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${PURPLE}, ${ORANGE})` }}>
                <Volleyball className="h-4 w-4" />
              </div>
              <span className="font-extrabold">Liga de Voleibol Jundiaí</span>
            </div>
            <p className="text-sm text-slate-400">O ponto de encontro do vôlei jundiaiense. Temporada 2025.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Patrocínio</h4>
            <p className="text-sm text-slate-400">Quer ver sua marca aqui e nas telas de classificação? Fale com a organização.</p>
            <div className="mt-3 h-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-sm text-slate-500">
              Espaço reservado para patrocinadores
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Contato</h4>
            <p className="text-sm text-slate-400">contato@lvj.com.br</p>
            <p className="text-sm text-slate-400">Jundiaí - SP</p>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-500 text-center">
          © 2025 Liga de Voleibol Jundiaí. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}

export default App
