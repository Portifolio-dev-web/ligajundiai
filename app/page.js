'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { toastSuccess, toastError } from '@/lib/toast'
import {
  Volleyball,
  Trophy,
  Users,
  CalendarDays,
  LogOut,
  Menu,
  UserPlus,
  LoaderCircle,
} from 'lucide-react'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { formatRg, getAge, isValidRg } from '@/lib/athlete'
import { financialResponsibilityTerm, IMAGE_USE_TERM, MINOR_GUARDIAN_TERM } from '@/lib/legalTerms'
// Paleta alinhada ao logo oficial da LVJ (marinho + vermelho + azul da bola) — compartilhada com
// components/standings.jsx e components/admin/AdminDashboard.jsx, por isso vive em lib/theme.js.
import { BLUE, RED, NAVY } from '@/lib/theme'
import { StandingsTable, StatusBadge } from '@/components/standings'

// SEGURANÇA (varredura, item S11): antes essas imagens vinham direto de images.unsplash.com — cada
// visita à home entregava o IP de quem acessa à Unsplash (hotlink). Agora são arquivos locais em
// public/images, as mesmas fotos, baixadas uma vez. IMG_ACTION1 nunca era usada — removida.
const HERO = '/images/hero.jpg'
const IMG_COURT = '/images/court.jpg'
const IMG_ARENA = '/images/arena.jpg'

// ============================================================================
// Root App
// ============================================================================
function App() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [myTeams, setMyTeams] = useState([])
  const [categories, setCategories] = useState(CATEGORY_FALLBACK)
  const [loginOpen, setLoginOpen] = useState(false)
  const [booting, setBooting] = useState(true)
  const currentYear = new Date().getFullYear()

  // SEGURANÇA/ARQUITETURA (refatoração 2026-10-23): o Painel Administrativo morou aqui, embutido em
  // "/" por checagem só client-side (user.role === 'admin'); agora vive em /admin, atrás do
  // middleware.js (verifica o JWT antes de renderizar, no Edge — não só depois que o React montou).
  // Quem loga como admin pelo diálogo (sem navegação de página) é redirecionado aqui; quem chega
  // direto em "/" já logado como admin é redirecionado antes mesmo deste componente montar (ver
  // middleware.js). As duas camadas cobrem os dois jeitos de "chegar" nesta rota.
  useEffect(() => {
    if (user?.role === 'admin') router.replace('/admin')
  }, [user, router])

  // ACESSIBILIDADE (varredura, item A4): a home vira o painel do admin/gestor dependendo de quem
  // está logado, sem navegar para outra rota — sem isso, a aba sempre mostrava o título genérico
  // do layout, mesmo para quem já estava num painel interno.
  useEffect(() => {
    document.title = user?.role === 'admin'
      ? 'Painel do administrador | Liga de Voleibol Jundiaí (LVJ)'
      : user?.role === 'gestor'
        ? 'Painel do gestor | Liga de Voleibol Jundiaí (LVJ)'
        : 'Liga de Voleibol Jundiaí (LVJ)'
  }, [user?.role])

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
    toastSuccess(`Bem-vindo(a), ${authenticatedUser.name}!`)
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

  if (booting || user?.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1E1B4B] text-white">
        <Volleyball className="h-8 w-8 animate-spin" style={{ color: RED }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* UX (achado lateral, varredura do Lote 2): em "top-right" o toast ficava por cima do
          cabeçalho fixo por alguns segundos em telas estreitas, bloqueando o clique no menu mobile
          (item A5) até desaparecer. "bottom-right" nunca sobrepõe o cabeçalho. */}
      <Toaster position="bottom-right" richColors />
      <TopNav
        user={user}
        token={token}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={logout}
      />
      {/* ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
          conteúdo" em app/layout.js — fica depois do TopNav, então o link realmente pula a navegação. */}
      <main id="main-content">
        {user?.role === 'gestor' ? (
          <GestorPanel token={token} categories={categories} user={user} myTeams={myTeams} refreshMe={() => loadMe(token)} />
        ) : (
          <PublicSite categories={categories} currentYear={currentYear} onLoginClick={() => setLoginOpen(true)} />
        )}
      </main>
      <Footer />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onAuthed={onAuthed} />
      {/* LGPD (varredura, item L10): ver ReconsentDialog abaixo. */}
      {user?.consent_outdated && <ReconsentDialog onAccepted={loadMe} />}
    </div>
  )
}

// LGPD (varredura, item L10): a Política/Termos mudaram de versão depois que esta pessoa consentiu
// (user.consent_outdated, calculado em GET /auth/me) — sem isso, o acesso continuava liberado para
// sempre com base num consentimento desatualizado. Diálogo sem "Cancelar" nem fechar por fora/Esc:
// não é uma notificação que dá para adiar, é o próprio consentimento que falta.
function ReconsentDialog({ onAccepted }) {
  const [accepting, setAccepting] = useState(false)
  const accept = async () => {
    setAccepting(true)
    try {
      await api('/auth/reconsent', { method: 'POST' })
      await onAccepted()
      toastSuccess('Consentimento atualizado. Obrigado!')
    } catch (e) {
      toastError(e.message)
    } finally {
      setAccepting(false)
    }
  }
  return (
    <AlertDialog open>
      <AlertDialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>A Política de Privacidade e os Termos de Uso mudaram</AlertDialogTitle>
          <AlertDialogDescription>
            Você consentiu com uma versão anterior. Leia a{' '}
            <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link>
            {' '}e os <Link className="underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>{' '}
            atuais antes de continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={accept} disabled={accepting}>
            {accepting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Li e aceito a versão atual
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
          {/* SEGURANÇA/ARQUITETURA (refatoração 2026-10-23): TopNav só renderiza com "user" preenchido
              para quem fica autenticado em "/" — hoje só o gestor; admin é redirecionado para /admin
              antes deste componente montar (ver App(), acima), então os links daqui são só do gestor. */}
          {user ? (
            <>
              <Badge className="hidden sm:inline-flex text-white border-0" style={{ background: RED }}>
                Gestor de Equipe
              </Badge>
              <span className="hidden sm:block text-sm text-slate-200">{user.name}</span>
              <a href="/gestor" className="hidden text-sm text-white underline sm:inline">Minha equipe</a>
              <a href="/gestor/aprovar-atletas" className="hidden text-sm text-white underline sm:inline">Aprovar atletas</a>
              <a href="/gestor/jogos" className="hidden text-sm text-white underline sm:inline">Agenda</a>
              <a href="/jogos" className="hidden text-sm text-white underline md:inline">Jogos</a>
              {/* ACESSIBILIDADE (varredura, item A5): abaixo de sm, todos os links acima ficam
                  escondidos e não havia nenhum jeito de alcançá-los — quem acessa pelo celular só
                  via o botão "Sair". Este menu reúne os mesmos links só nessa faixa de largura. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="secondary" className="sm:hidden" aria-label="Abrir menu de navegação">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="sm:hidden">
                  <div className="px-2 py-1.5 text-sm font-medium">{user.name}</div>
                  <div className="px-2 pb-1.5 text-xs text-muted-foreground">Gestor de Equipe</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><a href="/gestor">Minha equipe</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href="/gestor/aprovar-atletas">Aprovar atletas</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href="/gestor/jogos">Agenda</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href="/jogos">Jogos</a></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut className="h-4 w-4 mr-1" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="secondary" className="hidden sm:inline-flex" onClick={onLogout}>
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
    // ACESSIBILIDADE (varredura, item A3): era um segundo <main>, aninhado dentro do
    // <main id="main-content"> de TopNav/page.js — dois landmarks "main" (um dentro do outro)
    // confundem a navegação por landmarks de leitor de tela. O <main> real já existe lá fora.
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: NAVY }}>
        {/* PERFORMANCE (varredura, item I3): "priority" porque esta é a imagem de maior destaque
            visual na primeira tela (LCP) — sem ela, next/image carregaria a hero com o mesmo
            atraso ("lazy") das imagens abaixo da dobra (court/arena, mais adiante nesta página). */}
        <Image src={HERO} alt="Vôlei" fill priority sizes="100vw" className="object-cover opacity-25" />
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
          {/* SEGURANÇA (varredura, item A11): text-slate-600 sobre fundo branco dá ~2,9:1 de contraste,
              abaixo do mínimo de 4,5:1 (WCAG 1.4.3) — slate-600 cobre esse mínimo com boa margem. */}
          <p className="text-center text-xs uppercase tracking-widest text-slate-600 mb-4">
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
                <Image src={IMG_COURT} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
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
                      {m.home_name} <span className="text-slate-600">x</span> {m.away_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}
                    </div>
                  </div>
                ))}
                {matches.filter((m) => m.status === 'scheduled').length === 0 && (
                  <p className="text-sm text-slate-600">Nenhum jogo agendado.</p>
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
              <p className="text-sm text-slate-600">Ainda não há resultados registrados.</p>
            )}
          </div>
        </div>
      </section>

      {/* Community / sponsor banner */}
      {/* PERFORMANCE (varredura, item I3): a altura (h-64) precisou subir para a <section> — antes
          vinha do próprio <img> no fluxo normal; o next/image com "fill" tira a imagem do fluxo
          (position: absolute), então sem essa altura na section o bloco colapsaria para 0px. */}
      <section className="relative h-64">
        <Image src={IMG_ARENA} alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 flex items-center" style={{ background: `${NAVY}cc` }}>
          <div className="container text-white">
            <h3 className="text-3xl font-extrabold max-w-lg">Faça parte da maior liga de vôlei da região</h3>
            <Button className="mt-4 text-white border-0" style={{ background: RED }} onClick={onLoginClick}>
              Cadastrar equipe
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function MatchResultCard({ m }) {
  const hs = (m.sets || []).filter((s) => s.home > s.away).length
  const as = (m.sets || []).filter((s) => s.away > s.home).length
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-slate-600 mb-2">
        {m.category} {m.round ? `• ${m.round}` : ''}
      </div>
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${hs > as ? 'text-slate-900' : 'text-slate-600'}`}>{m.home_name}</span>
        <span className="mx-2 font-extrabold text-lg" style={{ color: BLUE }}>
          {hs} - {as}
        </span>
        <span className={`font-semibold text-right ${as > hs ? 'text-slate-900' : 'text-slate-600'}`}>{m.away_name}</span>
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
      toastError(teamPeriod?.message || 'Inscrições encerradas, te aguardamos na próxima temporada.')
      return
    }
    if (!teamForm.consent) {
      toastError('É necessário aceitar o Termo de Responsabilidade Financeira.')
      return
    }
    try {
      const d = await api('/teams', { method: 'POST', token, body: teamForm })
      setTeams((current) => [...current, d.team])
      setActiveTeamId(d.team.id)
      setTeamForm({ name: '', category: categories[0], consent: false })
      toastSuccess('Equipe enviada para aprovação!')
      refreshMe()
    } catch (e) {
      toastError(e.message)
    }
  }

  return (
    // ACESSIBILIDADE (varredura, item A3): mesmo motivo do PublicSite acima.
    <div className="container py-8">
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
    </div>
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
  // ACESSIBILIDADE (varredura, item A12): erro de cadastro de atleta só existia como toast — sem
  // foco movido nem campo marcado, quem usa teclado/leitor de tela não sabia onde corrigir.
  const [addError, setAddError] = useState('')
  const nameInputRef = useRef(null)

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
    setAddError('')
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
      toastSuccess('Atleta cadastrado e aguardando aprovação do gestor.')
      setForm({
        name: '', rg: '', position: '', birthdate: '', email: '', photo: null, consent: false,
        biometricConsent: false,
        guardianName: '', guardianRg: '', guardianRelationship: '',
      })
      load()
    } catch (e) {
      setAddError(e.message)
      nameInputRef.current?.focus()
      toastError(e.message)
    }
  }

  const review = async (id, action, reason = '') => {
    try {
      await api(`/gestor/athletes/${id}/${action}`, { method: 'POST', token, body: { justification: reason } })
      toastSuccess(action === 'approve' ? 'Atleta encaminhado para aprovação final.' : 'Cadastro do atleta recusado.')
      setRejectId(null)
      setJustification('')
      load()
    } catch (e) {
      toastError(e.message)
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
              <Input ref={nameInputRef} value={form.name} aria-invalid={!!addError} aria-describedby={addError ? 'add-athlete-error' : undefined} onChange={(e) => { setForm({ ...form, name: e.target.value }); setAddError('') }} />
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
            {addError && <p id="add-athlete-error" role="alert" className="md:col-span-2 text-xs text-red-600">{addError}</p>}
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
          {athletes.length === 0 && <p className="text-sm text-slate-600">Nenhum atleta no elenco.</p>}
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
        {rows.length === 0 && <p className="text-sm text-slate-600">Ainda não há registros de presença.</p>}
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
      toastSuccess('Aceite registrado.')
      load()
    } catch (e) {
      toastError(e.message)
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
                  {m.home_name} <span className="text-slate-600">x</span> {m.away_name}
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
        {filtered.length === 0 && <p className="text-sm text-slate-600">Nenhum jogo.</p>}
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
            {/* SEGURANÇA (varredura, item A11, achado ao aplicar a troca em massa): aqui o fundo é escuro
                (NAVY), não branco — text-slate-400 já tinha ~6,2:1 de contraste; trocar por slate-600
                (que passa no item A11 só sobre fundo BRANCO) derrubaria para ~2,1:1. Mantido slate-400. */}
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
            {/* UX (varredura, item O1): ver app/ajuda/page.jsx */}
            <Link className="underline hover:text-slate-300" href="/ajuda">Ajuda</Link>
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
