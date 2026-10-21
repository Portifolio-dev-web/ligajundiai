'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
  Info,
  Trash2,
  Save,
} from 'lucide-react'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { formatRg, getAge, isValidRg } from '@/lib/athlete'
import { financialResponsibilityTerm, IMAGE_USE_TERM, MINOR_GUARDIAN_TERM } from '@/lib/legalTerms'

// Paleta alinhada ao logo oficial da LVJ (marinho + vermelho + azul da bola), substituindo o
// roxo/laranja genérico usado antes de o logo real entrar no projeto.
const BLUE = '#2458A6'
const RED = '#E4242A'
const NAVY = '#1E1B4B'

const HERO = 'https://images.unsplash.com/photo-1547347298-4074fc3086f0'
const IMG_COURT = 'https://images.unsplash.com/photo-1666901356149-93f2eb3ba5a2'
const IMG_ACTION1 = 'https://images.unsplash.com/photo-1567880325673-ccc01edca61c'
const IMG_ARENA = 'https://images.unsplash.com/photo-1771909713106-86b9a412964a'

// ============================================================================
// Root App
// ============================================================================
function App() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [myTeams, setMyTeams] = useState([])
  const [categories, setCategories] = useState(CATEGORY_FALLBACK)
  const [loginOpen, setLoginOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const currentYear = new Date().getFullYear()

  const loadMe = useCallback(async () => {
    try {
      // Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe, então a
      // sessão devolve a lista inteira (teams), não mais "a equipe" no singular.
      const { user, teams } = await api('/auth/me')
      setToken(user ? 'cookie-session' : null)
      setUser(user)
      setMyTeams(teams || [])
    } catch {
      setToken(null)
      setUser(null)
      setMyTeams([])
    }
  }, [])

  const loadCategories = useCallback(() => {
    api('/categories').then((d) => setCategories(d.categories || CATEGORY_FALLBACK)).catch(() => {})
  }, [])

  useEffect(() => {
    loadCategories()
    loadMe().finally(() => setBooting(false))
  }, [loadCategories, loadMe])

  const onAuthed = (authenticatedUser) => {
    setToken('cookie-session')
    setUser(authenticatedUser)
    setLoginOpen(false)
    loadMe()
    toast.success(`Bem-vindo(a), ${authenticatedUser.name}!`)
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', token })
    } catch {}
    setToken(null)
    setUser(null)
    setMyTeams([])
    toast('Sessão encerrada')
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1E1B4B] text-white">
        <Volleyball className="h-8 w-8 animate-spin" style={{ color: RED }} />
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
      {/* ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
          conteúdo" em app/layout.js — fica depois do TopNav, então o link realmente pula a navegação. */}
      <main id="main-content">
        {user?.role === 'admin' ? (
          <AdminPanel token={token} categories={categories} onCategoriesChanged={loadCategories} />
        ) : user?.role === 'gestor' ? (
          <GestorPanel token={token} categories={categories} user={user} myTeams={myTeams} refreshMe={() => loadMe(token)} />
        ) : (
          <PublicSite categories={categories} currentYear={currentYear} onLoginClick={() => setLoginOpen(true)} />
        )}
      </main>
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
    <header className="sticky top-0 z-40 border-b border-white/10" style={{ background: NAVY }}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${BLUE}, ${RED})` }}
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
              <Badge
                className="hidden sm:inline-flex text-white border-0"
                style={{ background: user.role === 'admin' ? BLUE : RED }}
              >
                {user.role === 'admin' ? 'Administrador' : 'Gestor de Equipe'}
              </Badge>
              <span className="hidden sm:block text-sm text-slate-200">{user.name}</span>
              {user.role === 'admin' ? (
                <>
                  <a href="/admin/aprovacoes" className="hidden text-sm text-white underline sm:inline">Aprovações</a>
                  <a href="/admin/inscricoes" className="text-xs text-white underline">Períodos</a>
                </>
              ) : (
                <>
                  <a href="/gestor" className="hidden text-sm text-white underline sm:inline">Minha equipe</a>
                  <a href="/gestor/aprovar-atletas" className="hidden text-sm text-white underline sm:inline">Aprovar atletas</a>
                  <a href="/gestor/jogos" className="hidden text-sm text-white underline sm:inline">Agenda</a>
                </>
              )}
              <a href="/jogos" className="hidden text-sm text-white underline md:inline">Jogos</a>
              <Button size="sm" variant="secondary" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onLoginClick}
              className="text-white border-0"
              style={{ background: RED }}
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// PUBLIC SITE
// ============================================================================
function PublicSite({ categories, currentYear, onLoginClick }) {
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
      <section className="relative overflow-hidden" style={{ background: NAVY }}>
        <img src={HERO} alt="Vôlei" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(120deg, ${NAVY}ee, ${BLUE}aa)` }}
        />
        <div className="container relative py-20 md:py-28 text-white">
          <Badge className="mb-4 border-0 text-white" style={{ background: RED }}>
            Temporada {currentYear}
          </Badge>
          <h1 className="max-w-2xl text-4xl md:text-6xl font-extrabold leading-tight">
            A casa do vôlei em <span style={{ color: RED }}>Jundiaí</span>
          </h1>
          <p className="mt-4 max-w-xl text-slate-200 text-lg">
            Classificação em tempo real, agenda de jogos, gestão de equipes e atletas. Tudo em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={onLoginClick} className="text-white border-0" style={{ background: RED }}>
              Inscrever minha equipe
            </Button>
            <Button size="lg" onClick={onLoginClick} className="text-white border-0" style={{ background: RED }}>
              <a href="/cadastro-atleta">Cadastrar atleta</a>
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
                  style={{ background: BLUE }}
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
            <h2 className="text-3xl font-extrabold" style={{ color: NAVY }}>
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
            <CardHeader className="text-white" style={{ background: `linear-gradient(90deg, ${BLUE}, ${NAVY})` }}>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" style={{ color: RED }} /> {category}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <StandingsTable standings={standings} category={category} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Sponsor highlight box next to standings */}
            <Card className="overflow-hidden border-2" style={{ borderColor: RED }}>
              <div className="relative h-28">
                <img src={IMG_COURT} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${BLUE}bb` }}>
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
                  <CalendarDays className="h-4 w-4" style={{ color: BLUE }} /> Próximos jogos
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
          <h2 className="text-2xl font-extrabold mb-6" style={{ color: NAVY }}>
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
        <div className="absolute inset-0 flex items-center" style={{ background: `${NAVY}cc` }}>
          <div className="container text-white">
            <h3 className="text-3xl font-extrabold max-w-lg">Faça parte da maior liga de vôlei da região</h3>
            <Button className="mt-4 text-white border-0" style={{ background: RED }} onClick={onLoginClick}>
              Cadastrar equipe
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function categoryAbbrev(category) {
  if (!category) return '#'
  const letters = category
    .split(/[\s-]+/)
    .filter((word) => /^[A-Za-zÀ-ÿ]/.test(word))
    .map((word) => word[0].toUpperCase())
    .join('')
  return letters || '#'
}

function formatAverage(value) {
  const n = Number(value) || 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const STANDINGS_LEGEND = [
  { abbr: 'PTS', label: 'Pontos' },
  { abbr: 'J', label: 'Jogos' },
  { abbr: 'V', label: 'Vitórias' },
  { abbr: 'D', label: 'Derrotas' },
  { abbr: 'SP', label: 'Sets pró' },
  { abbr: 'SC', label: 'Sets contra' },
  { abbr: 'S.A', label: 'Sets average (SP ÷ SC)' },
  { abbr: 'PP', label: 'Pontos pró' },
  { abbr: 'PC', label: 'Pontos contra' },
  { abbr: 'PA', label: 'Pontos average (PP ÷ PC)' },
]

function StandingsLegend({ category, abbr }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver legenda das siglas da tabela"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
        >
          <Info className="h-3.5 w-3.5" /> Legenda
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-xs text-slate-600">
        <p className="mb-2 font-semibold text-slate-700">
          {abbr} — {category}
        </p>
        <ul className="space-y-1">
          {STANDINGS_LEGEND.map((item) => (
            <li key={item.abbr} className="flex gap-2">
              <span className="w-10 shrink-0 font-bold" style={{ color: BLUE }}>
                {item.abbr}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function StandingsTable({ standings, category }) {
  const abbr = categoryAbbrev(category)
  return (
    <div>
      <div className="flex items-center justify-end px-3 pt-3">
        <StandingsLegend category={category} abbr={abbr} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{abbr}</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead className="text-center">Pts</TableHead>
            <TableHead className="text-center">J</TableHead>
            <TableHead className="text-center">V</TableHead>
            <TableHead className="text-center">D</TableHead>
            <TableHead className="text-center hidden sm:table-cell">SP</TableHead>
            <TableHead className="text-center hidden sm:table-cell">SC</TableHead>
            <TableHead className="text-center hidden md:table-cell">S.A</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PP</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PC</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((s) => (
            <TableRow key={s.team_id}>
              <TableCell>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: s.position <= 4 ? RED : '#94a3b8' }}
                >
                  {s.position}
                </span>
              </TableCell>
              <TableCell className="font-semibold">{s.name}</TableCell>
              <TableCell className="text-center font-bold" style={{ color: BLUE }}>
                {s.points}
              </TableCell>
              <TableCell className="text-center">{s.played}</TableCell>
              <TableCell className="text-center">{s.wins}</TableCell>
              <TableCell className="text-center">{s.losses}</TableCell>
              <TableCell className="text-center hidden sm:table-cell text-slate-500">{s.sets_won}</TableCell>
              <TableCell className="text-center hidden sm:table-cell text-slate-500">{s.sets_lost}</TableCell>
              <TableCell className="text-center hidden md:table-cell text-slate-500">{formatAverage(s.sets_ratio)}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{s.rally_for}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{s.rally_against}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{formatAverage(s.points_ratio)}</TableCell>
            </TableRow>
          ))}
          {standings.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-slate-400 py-8">
                Nenhuma equipe aprovada nesta categoria ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
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
        <span className="mx-2 font-extrabold text-lg" style={{ color: BLUE }}>
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

  const loginPw = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/login-password', { method: 'POST', body: { email: pwEmail, password: pw, ...(pwTotp ? { totp: pwTotp } : {}) } })
      onAuthed(d.user)
    } catch (e) {
      if (e.code === 'TOTP_REQUIRED') setRequiresTotp(true)
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }
  const doRegister = async () => {
    setLoading(true)
    try {
      const d = await api('/auth/register', { method: 'POST', body: reg })
      onAuthed(d.user)
    } catch (e) {
      toast.error(e.message)
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
              <Input id="login-password-email" type="email" autoComplete="email" value={pwEmail} onChange={(e) => setPwEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
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
              <Input id="manager-register-email" type="email" autoComplete="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
            </div>
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

// ============================================================================
// ADMIN PANEL
// ============================================================================
function AdminPanel({ token, categories, onCategoriesChanged }) {
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
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldCheck className="h-6 w-6" style={{ color: BLUE }} /> Painel Administrativo
          </h1>
          <p className="text-slate-500 text-sm">Gestão completa da Liga de Voleibol Jundiaí</p>
        </div>
        <NotificationBell notif={notif} token={token} reload={loadNotif} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Equipes" value={stats.teams || 0} icon={Users} color={BLUE} />
        <StatCard label="Atletas" value={stats.athletes || 0} icon={Volleyball} color={RED} />
        <StatCard label="Jogos" value={stats.matches || 0} icon={CalendarDays} color={NAVY} />
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
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
        </TabsList>

        <TabsContent value="equipes"><AdminTeams token={token} reload={loadNotif} /></TabsContent>
        <TabsContent value="atletas"><AdminAthletes token={token} reload={loadNotif} /></TabsContent>
        <TabsContent value="jogos"><AdminMatches token={token} categories={categories} /></TabsContent>
        <TabsContent value="presenca"><AdminAttendance token={token} categories={categories} /></TabsContent>
        <TabsContent value="categorias"><AdminCategories token={token} onCategoriesChanged={onCategoriesChanged} /></TabsContent>
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
              style={{ background: RED }}
            >
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex items-center justify-between" style={{ background: NAVY }}>
          <span className="text-white font-semibold text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: RED }} /> Central de Notificações
          </span>
          <button className="text-xs text-slate-300 hover:text-white" onClick={markAll}>
            marcar lidas
          </button>
        </div>
        <div className="p-3 space-y-2 border-b bg-red-50">
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
        <CardDescription>Atletas cadastrados pelos gestores. Mesmo RG pode existir em várias categorias.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {athletes.map((a) => (
          <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">
                RG {a.rg} • {a.team_name} • {a.category} {a.position ? `• ${a.position}` : ''}
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
          <Settings className="h-5 w-5" style={{ color: BLUE }} /> Motor de Regras Configuráveis
        </CardTitle>
        <CardDescription>Defina a pontuação, critérios de desempate e presença mínima. A tabela é recalculada automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold mb-3" style={{ color: NAVY }}>Pontuação por resultado</h4>
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
          <h4 className="font-semibold mb-3" style={{ color: NAVY }}>Critérios de desempate (ordem de prioridade)</h4>
          <div className="space-y-2">
            {rules.tiebreakers.map((tb, idx) => {
              const opt = tiebreakerOptions.find((o) => o.key === tb)
              return (
                <div key={tb} className="flex items-center gap-2 rounded-lg border p-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: BLUE }}>
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
          <h4 className="font-semibold mb-3" style={{ color: NAVY }}>Presença mínima para finais/mata-mata</h4>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={rules.min_attendance_percent}
              onChange={(e) => setRules({ ...rules, min_attendance_percent: Number(e.target.value) })}
            />
            <span className="text-slate-500">%</span>
          </div>
        </div>

        <Button className="text-white border-0" style={{ background: RED }} onClick={save} disabled={saving}>
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
          <Button className="text-white border-0" style={{ background: BLUE }} onClick={create}>
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
                    {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: BLUE }}>({hs}-{as})</span>}
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
          <Button className="text-white border-0" style={{ background: RED }} onClick={saveResult}>Salvar resultado</Button>
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
                  <span className="text-sm">{a.name} <span className="text-xs text-slate-400">RG {a.rg}</span></span>
                  <input type="checkbox" className="h-5 w-5" checked={!!present[a.id]} onChange={(e) => setPresent({ ...present, [a.id]: e.target.checked })} />
                </label>
              ))}
              {athletes.length === 0 && <p className="p-3 text-sm text-slate-400">Nenhum atleta aprovado nesta equipe.</p>}
            </div>
            <div className="flex gap-2">
              <Button className="text-white border-0" style={{ background: BLUE }} onClick={save} disabled={athletes.length === 0}>Registrar presença</Button>
              <Button variant="outline" onClick={uploadSumula}><ClipboardList className="h-4 w-4 mr-1" /> Importar súmula (MOCKED)</Button>
            </div>

            {freq.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2" style={{ color: NAVY }}>Frequência da equipe</h4>
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
      <CardContent className="p-0"><StandingsTable standings={standings} category={category} /></CardContent>
    </Card>
  )
}

function AdminCategories({ token, onCategoriesChanged }) {
  const [categories, setCategories] = useState([])
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [newForm, setNewForm] = useState({ name: '', abbreviation: '', sort_order: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    api('/admin/categories', { token }).then((d) => {
      const list = d.categories || []
      setCategories(list)
      setDrafts(Object.fromEntries(list.map((c) => [c.id, { name: c.name, abbreviation: c.abbreviation, sort_order: String(c.sort_order) }])))
    }).catch(() => {})
  }, [token])
  useEffect(load, [load])

  const setDraft = (id, field, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const isDirty = (cat) => {
    const d = drafts[cat.id]
    if (!d) return false
    return d.name !== cat.name || d.abbreviation !== cat.abbreviation || Number(d.sort_order) !== cat.sort_order
  }

  const saveCategory = async (cat) => {
    const d = drafts[cat.id]
    setSavingId(cat.id)
    try {
      const { category } = await api(`/admin/categories/${cat.id}`, {
        method: 'PUT',
        token,
        body: { name: d.name.trim(), abbreviation: d.abbreviation.trim(), sort_order: Number(d.sort_order) || 0 },
      })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      toast.success('Categoria atualizada')
      onCategoriesChanged?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingId(null)
    }
  }

  const toggleActive = async (cat) => {
    try {
      const { category } = await api(`/admin/categories/${cat.id}`, { method: 'PUT', token, body: { active: !cat.active } })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      toast.success(category.active ? 'Categoria ativada' : 'Categoria desativada')
      onCategoriesChanged?.()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const removeCategory = async (cat) => {
    if (!window.confirm(`Remover a categoria "${cat.name}"? Essa ação não pode ser desfeita.`)) return
    try {
      await api(`/admin/categories/${cat.id}`, { method: 'DELETE', token })
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      toast.success('Categoria removida')
      onCategoriesChanged?.()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const createCategory = async () => {
    if (!newForm.name.trim() || !newForm.abbreviation.trim()) {
      toast.error('Informe nome e sigla da categoria')
      return
    }
    setCreating(true)
    try {
      const { category } = await api('/admin/categories', {
        method: 'POST',
        token,
        body: {
          name: newForm.name.trim(),
          abbreviation: newForm.abbreviation.trim(),
          sort_order: Number(newForm.sort_order) || (categories.length + 1),
        },
      })
      setCategories((prev) => [...prev, category].sort((a, b) => a.sort_order - b.sort_order))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      setNewForm({ name: '', abbreviation: '', sort_order: '' })
      toast.success('Categoria criada')
      onCategoriesChanged?.()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Categorias</CardTitle>
        <CardDescription>
          Gerencie as categorias do campeonato (nome, sigla e ordem de exibição). Renomear ou remover uma categoria
          com equipes ou jogos cadastrados é bloqueado — nesse caso, desative-a e crie uma nova.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_auto] gap-2 items-end bg-slate-50">
          <div>
            <Label className="text-xs text-slate-500">Nova categoria</Label>
            <Input placeholder="Ex: Sub-21 Masculino" value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Sigla</Label>
            <Input placeholder="Ex: S21" maxLength={6} value={newForm.abbreviation} onChange={(e) => setNewForm((f) => ({ ...f, abbreviation: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Ordem</Label>
            <Input type="number" placeholder="Auto" value={newForm.sort_order} onChange={(e) => setNewForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </div>
          <Button onClick={createCategory} disabled={creating} className="text-white border-0" style={{ background: BLUE }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-28">Sigla</TableHead>
              <TableHead className="w-24 text-center">Ordem</TableHead>
              <TableHead className="w-20 text-center">Ativa</TableHead>
              <TableHead className="w-28 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => {
              const d = drafts[cat.id] || { name: cat.name, abbreviation: cat.abbreviation, sort_order: String(cat.sort_order) }
              const dirty = isDirty(cat)
              return (
                <TableRow key={cat.id} className={!cat.active ? 'opacity-50' : ''}>
                  <TableCell>
                    <Input value={d.name} onChange={(e) => setDraft(cat.id, 'name', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input maxLength={6} value={d.abbreviation} onChange={(e) => setDraft(cat.id, 'abbreviation', e.target.value.toUpperCase())} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" className="text-center" value={d.sort_order} onChange={(e) => setDraft(cat.id, 'sort_order', e.target.value)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={cat.active} onCheckedChange={() => toggleActive(cat)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" disabled={!dirty || savingId === cat.id} onClick={() => saveCategory(cat)} title="Salvar alterações">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => removeCategory(cat)} title="Remover categoria">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-400 py-8">Nenhuma categoria cadastrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
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
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" style={{ color: RED }} /> E-mails transacionais (MOCKED)</CardTitle>
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
function GestorPanel({ token, categories, user, myTeams, refreshMe }) {
  // Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe, então o painel
  // precisa de um seletor de equipe ativa; elenco, frequência, classificação e agenda continuam
  // mostrando uma equipe por vez, só que agora a pessoa escolhe qual.
  const [teams, setTeams] = useState(myTeams)
  const [activeTeamId, setActiveTeamId] = useState(myTeams[0]?.id ?? '')
  const [teamForm, setTeamForm] = useState({ name: '', category: categories[0], consent: false })
  const [registrationPeriods, setRegistrationPeriods] = useState([])

  useEffect(() => setTeams(myTeams), [myTeams])
  useEffect(() => {
    setActiveTeamId((current) => (myTeams.some((team) => team.id === current) ? current : (myTeams[0]?.id ?? '')))
  }, [myTeams])
  useEffect(() => {
    api('/registration-periods')
      .then((result) => setRegistrationPeriods(result.periods || []))
      .catch(() => {})
  }, [])

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null
  const teamPeriod = registrationPeriods.find((period) => (
    period.category === teamForm.category && period.registration_type === 'team'
  ))
  const teamRegistrationOpen = teamPeriod?.status === 'open'

  const createTeam = async () => {
    if (!teamRegistrationOpen) {
      toast.error(teamPeriod?.message || 'Inscrições encerradas, te aguardamos na próxima temporada.')
      return
    }
    if (!teamForm.consent) {
      toast.error('É necessário aceitar o Termo de Responsabilidade Financeira.')
      return
    }
    try {
      const d = await api('/teams', { method: 'POST', token, body: teamForm })
      setTeams((current) => [...current, d.team])
      setActiveTeamId(d.team.id)
      setTeamForm({ name: '', category: categories[0], consent: false })
      toast.success('Equipe enviada para aprovação!')
      refreshMe()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1" style={{ color: NAVY }}>
        <Users className="h-6 w-6" style={{ color: BLUE }} /> Painel do Gestor
      </h1>
      <p className="text-slate-500 text-sm mb-6">Olá {user.name}, gerencie suas equipes e elencos.</p>

      {teams.length > 0 && <>
        {teams.length > 1 && <div className="mb-4 max-w-xs">
          <Label className="text-xs">Equipe</Label>
          <Select value={activeTeamId} onValueChange={setActiveTeamId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name} — {team.category}</SelectItem>)}</SelectContent>
          </Select>
        </div>}

        {activeTeam && <>
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{activeTeam.name}</div>
                <div className="text-sm text-slate-500">{activeTeam.category}</div>
                {activeTeam.status === 'rejected' && activeTeam.justification && (
                  <div className="text-xs text-red-500 mt-1">Motivo da recusa: {activeTeam.justification}</div>
                )}
              </div>
              <StatusBadge status={activeTeam.status} />
            </CardContent>
          </Card>

          <Tabs defaultValue="elenco" key={activeTeam.id}>
            <TabsList>
              <TabsTrigger value="elenco">Elenco</TabsTrigger>
              <TabsTrigger value="frequencia">Frequência</TabsTrigger>
              <TabsTrigger value="classificacao">Classificação</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
            <TabsContent value="elenco"><GestorRoster token={token} team={activeTeam} /></TabsContent>
            <TabsContent value="frequencia"><GestorFrequency token={token} teamId={activeTeam.id} /></TabsContent>
            <TabsContent value="classificacao"><GestorStandings token={token} category={activeTeam.category} /></TabsContent>
            <TabsContent value="agenda"><GestorAgenda category={activeTeam.category} token={token} team={activeTeam} /></TabsContent>
          </Tabs>
        </>}
      </>}

      <Card className={teams.length ? 'mt-6 max-w-lg' : 'max-w-lg'}>
        <CardHeader>
          <CardTitle>{teams.length ? 'Cadastrar outra equipe' : 'Inscrever equipe'}</CardTitle>
          <CardDescription>As inscrições de equipes acontecem no período definido pelo administrador para cada categoria.</CardDescription>
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
          {teamRegistrationOpen
            ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:col-span-2">
              Inscrições abertas até {new Date(teamPeriod.ends_at).toLocaleString('pt-BR')}.
            </div>
            : <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
              {teamPeriod?.message || 'Inscrições encerradas, te aguardamos na próxima temporada.'}
            </div>}
          {/* Risco 3 (análise LVJ 2027): texto real do Termo de Responsabilidade Financeira em
              papel, não mais o aceite genérico de dados. */}
          <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
            {financialResponsibilityTerm({ teamName: teamForm.name, category: teamForm.category })}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={teamForm.consent} onCheckedChange={(checked) => setTeamForm({ ...teamForm, consent: checked === true })} />
            <span>Li e aceito o Termo de Responsabilidade Financeira acima.</span>
          </label>
          <Button className="text-white border-0" style={{ background: RED }} onClick={createTeam} disabled={!teamForm.name || !teamRegistrationOpen || !teamForm.consent}>
            Solicitar inscrição
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function GestorRoster({ token, team }) {
  const [athletes, setAthletes] = useState([])
  const [athletePeriod, setAthletePeriod] = useState(null)
  const [loadingAthletePeriod, setLoadingAthletePeriod] = useState(true)
  // LGPD (varredura, item L2): guardianName/guardianRg/guardianRelationship só são obrigatórios
  // quando a data de nascimento informada indicar menor de 18 anos (ver isMinor abaixo). Sem data
  // de nascimento aqui, não dá para saber a idade — mesma limitação já existente no backend.
  const [form, setForm] = useState({
    name: '', rg: '', position: '', birthdate: '', email: '', photo: null, consent: false,
    // LGPD (varredura, item L4): consentimento separado do geral (consent), só exigido quando há
    // foto — a biometria é dado sensível (art. 11, I) e precisa de aceite específico e destacado.
    biometricConsent: false,
    guardianName: '', guardianRg: '', guardianRelationship: '',
  })
  const [rejectId, setRejectId] = useState(null)
  const [justification, setJustification] = useState('')

  // Mesmo corte de idade do backend (createAthlete, MINOR_AGE_LIMIT em backend/src/routes/athletes.js),
  // calculado a partir da data de nascimento, para decidir se mostra os campos do responsável legal.
  const athleteAge = getAge(form.birthdate)
  const isMinor = athleteAge !== null && athleteAge < 18
  const validGuardianRg = isValidRg(form.guardianRg)

  const load = useCallback(() => {
    // Risco 1 (varredura, análise LVJ 2027): o elenco mostrado aqui é só da equipe ativa.
    api(`/athletes/mine?team_id=${team.id}`, { token }).then((d) => setAthletes(d.athletes || [])).catch(() => {})
  }, [token, team.id])
  useEffect(load, [load])
  useEffect(() => {
    api('/registration-periods')
      .then((result) => {
        setAthletePeriod(result.periods?.find((period) => (
          period.category === team.category && period.registration_type === 'athlete'
        )) ?? null)
      })
      .catch(() => {})
      .finally(() => setLoadingAthletePeriod(false))
  }, [team.category])

  const add = async () => {
    try {
      let biometry_key
      if (form.photo) {
        const upload = await api('/athletes/biometry-upload', {
          method: 'POST',
          token,
          body: { team_id: team.id, content_type: form.photo.type },
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
          team_id: team.id,
          name: form.name,
          rg: form.rg,
          position: form.position,
          birthdate: form.birthdate || undefined,
          email: form.email || undefined,
          consent: form.consent,
          ...(biometry_key ? { biometry_key, biometric_consent: form.biometricConsent } : {}),
          // LGPD (varredura, item L2): só enviados quando isMinor; o backend rejeita o cadastro de
          // um menor sem esses três campos (GUARDIAN_REQUIRED).
          ...(isMinor ? {
            guardian_name: form.guardianName.trim(),
            guardian_rg: form.guardianRg,
            guardian_relationship: form.guardianRelationship.trim(),
          } : {}),
        },
      })
      toast.success('Atleta cadastrado e aguardando aprovação do gestor.')
      setForm({
        name: '', rg: '', position: '', birthdate: '', email: '', photo: null, consent: false,
        biometricConsent: false,
        guardianName: '', guardianRg: '', guardianRelationship: '',
      })
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
        {team.status === 'approved' && loadingAthletePeriod ? (
          <div role="status" className="rounded-lg border p-3 text-sm text-slate-600">Verificando o período de cadastro de atletas…</div>
        ) : team.status === 'approved' && athletePeriod?.status === 'open' ? (
          <div className="grid gap-3 md:grid-cols-3 items-end rounded-lg border p-4 bg-slate-50">
            <div>
              <Label className="text-xs">Nome do atleta</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">RG</Label>
              <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: formatRg(e.target.value) })} />
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
              {/* LGPD (varredura, item L2): precisa ser obrigatória — sem ela não dá para saber se
                  o atleta é menor de idade, e o aviso do responsável legal abaixo nunca apareceria. */}
              <Label className="text-xs">Data de nascimento</Label>
              <Input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} required />
            </div>
            <div>
              <Label className="text-xs">E-mail do atleta (opcional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Foto para biometria (máx. 5 MB)</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] || null })} />
            </div>
            {/* LGPD (varredura, item L2): aparece só quando a data de nascimento indica menor de
                18 anos — art. 14 da LGPD exige o consentimento do responsável legal, identificado. */}
            {isMinor && <div className="md:col-span-2 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">Atleta menor de idade: informe o responsável legal.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Nome do responsável</Label>
                  <Input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">RG do responsável</Label>
                  <Input value={form.guardianRg} onChange={(e) => setForm({ ...form, guardianRg: formatRg(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Parentesco</Label>
                  <Input placeholder="mãe, pai, tutor(a)…" value={form.guardianRelationship} onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value })} />
                </div>
              </div>
            </div>}
            {/* Risco 3 (análise LVJ 2027): texto real do Termo de Autorização de Uso de Imagem
                (todo atleta) e, quando menor de idade, também da Autorização para Participação de
                Atletas Menores — não mais o aceite genérico de dados. */}
            {isMinor && <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{MINOR_GUARDIAN_TERM}</div>}
            <div className="md:col-span-2 rounded-md border bg-slate-50 p-3 text-xs text-slate-600">{IMAGE_USE_TERM}</div>
            {/* LGPD (varredura, item L4): checkbox separado do consentimento geral abaixo, só exigido
                quando há foto anexada — a biometria é dado sensível (art. 11, I). */}
            {form.photo && <label className="flex items-start gap-2 text-xs text-amber-900 md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <input type="checkbox" checked={form.biometricConsent} onChange={(e) => setForm({ ...form, biometricConsent: e.target.checked })} />
              <span>Confirmo o consentimento específico do atleta (ou responsável legal) para o tratamento da foto biométrica para controle de acesso (reconhecimento facial), como dado pessoal sensível (art. 11 da LGPD).</span>
            </label>}
            <label className="flex items-start gap-2 text-xs text-slate-600 md:col-span-2">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              <span>Confirmo que obtive o consentimento do atleta (ou responsável legal) para os termos acima e para tratar os dados e a foto biométrica, conforme a <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link> e os <Link className="underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>.</span>
            </label>
            <Button
              className="text-white border-0"
              style={{ background: BLUE }}
              onClick={add}
              disabled={!form.name || !form.rg || !form.position || !form.birthdate || !form.consent ||
                (form.photo && form.photo.size > 5 * 1024 * 1024) ||
                (form.photo && !form.biometricConsent) ||
                (isMinor && (!form.guardianName.trim() || !validGuardianRg || !form.guardianRelationship.trim()))}
            >
              <UserPlus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        ) : team.status !== 'approved' ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Sua equipe precisa ser aprovada pelo Admin antes de cadastrar atletas.
          </div>
        ) : (
          <div role="status" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            {athletePeriod?.message || 'Obrigado pelo interesse em participar, Cadastro encerrado.'}
          </div>
        )}

        <div className="space-y-2">
          {athletes.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-500">RG {a.rg} {a.position ? `• ${a.position}` : ''}</div>
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

function GestorFrequency({ token, teamId }) {
  const [data, setData] = useState({ attendance: [] })
  useEffect(() => {
    api('/attendance/mine', { token }).then(setData).catch(() => {})
  }, [token])
  // Risco 1 (varredura, análise LVJ 2027): /attendance/mine soma as equipes do gestor; aqui
  // filtramos para a equipe ativa no painel.
  const rows = (data.attendance || []).filter((item) => !teamId || item.team_id === teamId)
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Frequência (presença)</CardTitle>
        <CardDescription>Acompanhe a presença de cada atleta em relação à meta mínima da liga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((f) => (
          <div key={f.athlete_id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{f.name}</span>
              <Badge className="border-0 text-white" style={{ background: f.eligible ? '#16a34a' : '#dc2626' }}>
                {f.eligible ? `Apto (min ${f.min_required}%)` : `Inapto (min ${f.min_required}%)`}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.min(f.percent, 100)}%`, background: f.eligible ? '#16a34a' : RED }} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{f.present}/{f.total_sessions} presenças • {f.percent}%</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">Ainda não há registros de presença.</p>}
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
      <CardContent className="p-0"><StandingsTable standings={standings} category={category} /></CardContent>
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
                  {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: BLUE }}>({hs}-{as})</span>}
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
    <footer className="mt-12" style={{ background: NAVY }}>
      <div className="container py-10 text-slate-300">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-white mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${BLUE}, ${RED})` }}>
                <Volleyball className="h-4 w-4" />
              </div>
              <span className="font-extrabold">Liga de Voleibol Jundiaí</span>
            </div>
            <p className="text-sm text-slate-400">O ponto de encontro do vôlei jundiaiense. Temporada {new Date().getFullYear()}.</p>
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
        {/* LGPD (varredura, item L1): antes não havia nenhum link fixo para a política/termos fora do
            fluxo de cadastro; agora ficam acessíveis em qualquer página, mesmo sem estar logado. */}
        <div className="mt-8 border-t border-slate-700 pt-4 text-center text-xs text-slate-500">
          <div className="mb-2 flex items-center justify-center gap-4">
            <Link className="underline hover:text-slate-300" href="/privacidade">Política de Privacidade</Link>
            <Link className="underline hover:text-slate-300" href="/termos-de-uso">Termos de Uso</Link>
          </div>
          © {new Date().getFullYear()} Liga de Voleibol Jundiaí. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}

export default App
