'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { toastSuccess, toastError } from '@/lib/toast'
import {
  Volleyball,
  Trophy,
  CalendarDays,
  LogOut,
  LoaderCircle,
} from 'lucide-react'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { SponsorFlipCards } from '@/components/SponsorFlipCards'
import { SponsorVerticalTicker } from '@/components/SponsorVerticalTicker'
import { SponsorCoverFlow } from '@/components/SponsorCoverFlow'
import { AboutSection } from '@/components/AboutSection'
import { SponsorCtaSection } from '@/components/SponsorCtaSection'
// Paleta alinhada ao logo oficial da LVJ (marinho + vermelho + azul da bola) — compartilhada com
// components/standings.jsx e components/admin/AdminDashboard.jsx, por isso vive em lib/theme.js.
import { BLUE, RED, NAVY } from '@/lib/theme'
import { StandingsTable } from '@/components/standings'

// PERFORMANCE (varredura, item I2): o painel do gestor (components/gestor/GestorPanel.jsx) só é
// baixado por quem realmente loga como gestor — visitantes anônimos da home (a maioria do
// tráfego) nunca puxam esse bundle.
const GestorPanel = dynamic(() => import('@/components/gestor/GestorPanel'), {
  ssr: false,
  loading: () => (
    <div className="container py-16 flex items-center justify-center">
      <Volleyball className="h-6 w-6 animate-spin" style={{ color: RED }} />
    </div>
  ),
})

// PERFORMANCE (varredura): mesmo raciocínio do GestorPanel acima — "/" é a rota mais visitada do
// site, e os dois diálogos abaixo (Tabs, os dois formulários, chamadas de API) só importam depois
// de um clique em "Entrar" ou "Esqueci minha senha", nunca no primeiro carregamento. loginEverOpened
// em App(), mais abaixo, garante que o import só dispara após esse primeiro clique — sem isso, os
// dois já nasceriam montados na árvore (só escondidos pelo Dialog) e o code-splitting não valeria
// nada. Pré-carregados no onMouseEnter/onFocus do botão "Entrar" (ver prefetchLogin), então quem
// passa o mouse antes de clicar não sente a espera do download.
const LoginDialog = dynamic(() => import('@/components/LoginDialog'), { ssr: false })
const ForgotPasswordDialog = dynamic(() => import('@/components/ForgotPasswordDialog'), { ssr: false })

// SEGURANÇA (varredura, item S11): antes essas imagens vinham direto de images.unsplash.com — cada
// visita à home entregava o IP de quem acessa à Unsplash (hotlink). Agora são arquivos locais em
// public/images, as mesmas fotos, baixadas uma vez. IMG_ACTION1 nunca era usada — removida.
const HERO = '/images/hero.jpg'
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
  // PERFORMANCE: LoginDialog só entra na árvore (e só então baixa seu chunk — ver dynamic() acima)
  // depois do primeiro open; depois disso fica sempre montado, igual antes, pra não perder a
  // animação de fechar do Dialog entre uma abertura e outra.
  const [loginEverOpened, setLoginEverOpened] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordEverOpened, setForgotPasswordEverOpened] = useState(false)
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

  const openLogin = () => {
    setLoginEverOpened(true)
    setLoginOpen(true)
  }
  // PERFORMANCE: dispara o download do chunk do LoginDialog assim que alguém passa o mouse (ou o
  // foco do teclado) no botão "Entrar" — quem clica logo em seguida já encontra o componente
  // baixado, sem esperar a rede no meio do clique. import() repetido é seguro: o módulo só baixa
  // uma vez, as chamadas seguintes reaproveitam a mesma Promise já resolvida.
  const prefetchLogin = () => { import('@/components/LoginDialog') }

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
      <TopNav
        user={user}
        token={token}
        onLoginClick={openLogin}
        onLoginHover={prefetchLogin}
        onLogout={logout}
      />
      {/* ACESSIBILIDADE (varredura, item A1): id="main-content" é o alvo do link "Pular para o
          conteúdo" em app/layout.js — fica depois do TopNav, então o link realmente pula a navegação. */}
      <main id="main-content">
        {user?.role === 'gestor' ? (
          <GestorPanel token={token} categories={categories} user={user} myTeams={myTeams} refreshMe={() => loadMe(token)} />
        ) : (
          <PublicSite categories={categories} currentYear={currentYear} onLoginClick={openLogin} />
        )}
      </main>
      <Footer />
      {loginEverOpened && (
        <LoginDialog
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onAuthed={onAuthed}
          onForgotPassword={() => { setLoginOpen(false); setForgotPasswordEverOpened(true); setForgotPasswordOpen(true) }}
        />
      )}
      {forgotPasswordEverOpened && (
        <ForgotPasswordDialog
          open={forgotPasswordOpen}
          onOpenChange={setForgotPasswordOpen}
          onBackToLogin={() => setLoginOpen(true)}
        />
      )}
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
function TopNav({ user, token, onLoginClick, onLoginHover, onLogout }) {
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
              {/* PERFORMANCE/UX (mesma mudança do painel do admin): os links de navegação do
                  gestor (Minha equipe, Aprovar atletas, Agenda, Jogos) saíram daqui — viram abas
                  dentro do próprio Painel do Gestor (ver components/gestor/GestorPanel.jsx), que é
                  onde o gestor sempre cai depois do login. Sem links para esconder, o menu mobile
                  (DropdownMenu) também deixou de ser necessário — "Sair" sozinho cabe nas duas
                  larguras, então fica sempre visível em vez de duplicado em dois componentes. */}
              <Badge className="hidden sm:inline-flex text-white border-0" style={{ background: RED }}>
                Gestor de Equipe
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
              onMouseEnter={onLoginHover}
              onFocus={onLoginHover}
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

      <AboutSection />

      {/* SPONSOR STRIP */}
      <section className="border-y bg-white">
        <div className="container py-6">
          {/* SEGURANÇA (varredura, item A11): text-slate-600 sobre fundo branco dá ~2,9:1 de contraste,
              abaixo do mínimo de 4,5:1 (WCAG 1.4.3) — slate-600 cobre esse mínimo com boa margem. */}
          <p className="text-center text-xs uppercase tracking-widest text-slate-600 mb-4">
            Patrocinadores oficiais
          </p>
          {/* PERFORMANCE (varredura, item I-Média-2): altura fixa, não min-h variável — cada card
              de flip tem 92px de altura sempre, trocando só o número de colunas (2/3/5) conforme a
              tela, então não há salto de layout (CLS) entre o fetch de /sponsors responder e os
              cards aparecerem. */}
          <div className="min-h-[92px]">
            <SponsorFlipCards sponsors={sponsors} />
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
            {/* PERFORMANCE (varredura, item I-Média-2): min-h amortece o salto entre a linha única
                de "nenhuma equipe ainda" (StandingsTable, standings=[]) e a tabela populada. */}
            <CardContent className="p-0 min-h-[280px]">
              <StandingsTable standings={standings} category={category} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Sponsor highlight box next to standings */}
            <Card className="overflow-hidden border-2" style={{ borderColor: RED }}>
              <div className="py-2 text-center text-sm font-bold text-white" style={{ background: NAVY }}>
                Espaço Patrocinador
              </div>
              <SponsorVerticalTicker sponsors={sponsors} />
              <CardContent className="py-4 text-center text-sm text-slate-600">
                Marcas que apoiam o vôlei de Jundiaí.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" style={{ color: BLUE }} /> Próximos jogos
                </CardTitle>
              </CardHeader>
              {/* PERFORMANCE (varredura, item I-Média-2): min-h reserva espaço para a lista de
                  próximos jogos antes do fetch de /matches responder (ver mesmo motivo acima). */}
              <CardContent className="space-y-3 min-h-[200px]">
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
          {/* PERFORMANCE (varredura, item I-Média-2): mesmo motivo acima, para os resultados. */}
          <div className="grid gap-4 md:grid-cols-3 min-h-[150px]">
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

      <SponsorCtaSection />
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
// Footer with sponsors
// ============================================================================
function Footer() {
  // O rodapé aparece em toda página do site, não só na home — por isso busca os patrocinadores
  // por conta própria, em vez de receber a lista que PublicSite já buscou (ela nem sempre existe,
  // ex. em /ajuda, /privacidade).
  const [sponsors, setSponsors] = useState([])
  useEffect(() => {
    api('/sponsors').then((d) => setSponsors(d.sponsors || [])).catch(() => {})
  }, [])

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
            <p className="text-sm text-slate-400 mb-3">Confira quem apoia a liga:</p>
            {sponsors.length > 0 ? (
              <SponsorCoverFlow sponsors={sponsors} />
            ) : (
              <div className="h-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-sm text-slate-500">
                Espaço reservado para patrocinadores
              </div>
            )}
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
