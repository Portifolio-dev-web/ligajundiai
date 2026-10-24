'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Bell, CalendarDays, CheckCircle2, ClipboardList, LoaderCircle, ShieldCheck, Users, Volleyball,
  XCircle,
} from 'lucide-react'
import HelpLink from '@/components/HelpLink'
import LogoutButton from '@/components/LogoutButton'
import { StatusBadge } from '@/components/standings'
import { toastSuccess, toastError } from '@/lib/toast'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { BLUE, NAVY, RED } from '@/lib/theme'

// PERFORMANCE (varredura, item I-Baixa-3): /admin era o maior bundle do site (196 kB First Load JS)
// porque todas as 11 abas — a maioria usada com pouca frequência (E-mails, Segurança, Categorias,
// Inscrições, Regulamento, Datas, Presença) — carregavam de uma vez, mesmo o admin só vendo uma por
// vez. Só "Equipes" e "Atletas" (as mais usadas) continuam neste arquivo; as outras 9 viram chunks
// próprios em components/admin/tabs/, baixados sob demanda ao clicar na aba (next/dynamic).
function TabLoading() {
  return (
    <div className="mt-4 flex items-center justify-center rounded-lg border p-12 text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin mr-2" /> Carregando…
    </div>
  )
}

const AdminMatches = dynamic(() => import('@/components/admin/tabs/AdminMatches'), { loading: TabLoading })
const AdminGameDates = dynamic(() => import('@/components/admin/tabs/AdminGameDates'), { loading: TabLoading })
const AdminAttendance = dynamic(() => import('@/components/admin/tabs/AdminAttendance'), { loading: TabLoading })
const AdminRegistrationPeriods = dynamic(() => import('@/components/admin/tabs/AdminRegistrationPeriods'), { loading: TabLoading })
const RulesEngine = dynamic(() => import('@/components/admin/tabs/RulesEngine'), { loading: TabLoading })
const AdminStandings = dynamic(() => import('@/components/admin/tabs/AdminStandings'), { loading: TabLoading })
const AdminCategories = dynamic(() => import('@/components/admin/tabs/AdminCategories'), { loading: TabLoading })
const AdminEmails = dynamic(() => import('@/components/admin/tabs/AdminEmails'), { loading: TabLoading })
const AdminAccountSecurity = dynamic(() => import('@/components/admin/tabs/AdminAccountSecurity'), { loading: TabLoading })

// ============================================================================
// PAINEL ADMINISTRATIVO (refatoração 2026-10-23)
//
// Antes esta tela vivia embutida em "/" (app/page.js), mostrada por uma checagem só client-side
// (user.role === 'admin') — qualquer um que abrisse o DevTools via o código inteiro baixado junto
// com o site público, mesmo sem sessão (os dados em si continuavam protegidos pelas rotas da API,
// mas a "casca" da tela não deveria nem chegar ao navegador de quem não é admin). Agora mora em
// /admin, atrás do middleware.js (verifica o JWT — e a revogação de sessão — ANTES de servir
// qualquer HTML/JS desta tela, no Edge).
//
// Também unifica o que antes estava espalhado em 4 rotas dedicadas ("Gestão da Liga Jundiaí":
// /admin/aprovacoes, /admin/inscricoes, /admin/agenda, /admin/seguranca) nas abas "Equipes"/
// "Atletas" (aprovação já existia aqui, duplicada com /admin/aprovacoes), "Datas disponíveis",
// "Inscrições" e "Segurança" abaixo — um painel só, sem duas telas com o mesmo nome.
// ============================================================================
export default function AdminDashboard() {
  const [notif, setNotif] = useState({ pending_teams: 0, pending_athletes: 0, unread: 0, items: [] })
  const [stats, setStats] = useState({})
  const [categories, setCategories] = useState(CATEGORY_FALLBACK)

  const loadNotif = useCallback(() => {
    api('/admin/notifications').then(setNotif).catch(() => {})
    api('/admin/stats').then(setStats).catch(() => {})
  }, [])

  const loadCategories = useCallback(() => {
    api('/categories').then((d) => setCategories(d.categories || CATEGORY_FALLBACK)).catch(() => {})
  }, [])

  useEffect(() => {
    loadNotif()
    loadCategories()
    const t = setInterval(loadNotif, 15000)
    return () => clearInterval(t)
  }, [loadNotif, loadCategories])

  return (
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js.
    <main id="main-content" className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: NAVY }}>
            <ShieldCheck className="h-6 w-6" style={{ color: BLUE }} /> Painel Administrativo
          </h1>
          <p className="text-slate-500 text-sm">Gestão completa da Liga de Voleibol Jundiaí</p>
        </div>
        {/* ACESSIBILIDADE (varredura, item A10): ver components/LogoutButton.jsx. UX (item O1): ver components/HelpLink.jsx */}
        <div className="flex items-center gap-2">
          <NotificationBell notif={notif} reload={loadNotif} />
          <HelpLink />
          <LogoutButton />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Equipes" value={stats.teams || 0} icon={Users} color={BLUE} />
        <StatCard label="Atletas" value={stats.athletes || 0} icon={Volleyball} color={RED} />
        <StatCard label="Jogos" value={stats.matches || 0} icon={CalendarDays} color={NAVY} />
        <StatCard label="Equipes pend." value={stats.pending_teams || 0} icon={ClipboardList} color="#dc2626" />
        <StatCard label="Atletas pend." value={stats.pending_athletes || 0} icon={ClipboardList} color="#dc2626" />
      </div>

      <Tabs defaultValue="equipes">
        {/* UX (varredura, item U-Baixa-3): com 11 abas, "flex flex-wrap" quebrava em até 4 linhas
            de pills no mobile (375px) — denso e difícil de escanear. Uma faixa com rolagem
            horizontal (igual ao padrão já usado em app/gestor/aprovar-atletas e
            components/MatchAttendance.jsx para tabelas largas) cabe numa linha só. */}
        <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="equipes" className="shrink-0">Equipes</TabsTrigger>
          <TabsTrigger value="atletas" className="shrink-0">Atletas</TabsTrigger>
          <TabsTrigger value="jogos" className="shrink-0">Jogos & Resultados</TabsTrigger>
          <TabsTrigger value="datas" className="shrink-0">Datas disponíveis</TabsTrigger>
          <TabsTrigger value="presenca" className="shrink-0">Presença</TabsTrigger>
          <TabsTrigger value="inscricoes" className="shrink-0">Inscrições</TabsTrigger>
          <TabsTrigger value="regulamento" className="shrink-0">Regulamento</TabsTrigger>
          <TabsTrigger value="classificacao" className="shrink-0">Classificação</TabsTrigger>
          <TabsTrigger value="categorias" className="shrink-0">Categorias</TabsTrigger>
          <TabsTrigger value="emails" className="shrink-0">E-mails</TabsTrigger>
          <TabsTrigger value="seguranca" className="shrink-0">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="equipes"><AdminTeams reload={loadNotif} /></TabsContent>
        <TabsContent value="atletas"><AdminAthletes reload={loadNotif} /></TabsContent>
        <TabsContent value="jogos"><AdminMatches categories={categories} /></TabsContent>
        <TabsContent value="datas"><AdminGameDates categories={categories} /></TabsContent>
        <TabsContent value="presenca"><AdminAttendance categories={categories} /></TabsContent>
        <TabsContent value="inscricoes"><AdminRegistrationPeriods /></TabsContent>
        <TabsContent value="categorias"><AdminCategories onCategoriesChanged={loadCategories} /></TabsContent>
        <TabsContent value="regulamento"><RulesEngine /></TabsContent>
        <TabsContent value="classificacao"><AdminStandings categories={categories} /></TabsContent>
        <TabsContent value="emails"><AdminEmails /></TabsContent>
        <TabsContent value="seguranca"><AdminAccountSecurity /></TabsContent>
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

function NotificationBell({ notif, reload }) {
  const total = (notif.pending_teams || 0) + (notif.pending_athletes || 0)
  const markAll = async () => {
    await api('/admin/notifications/read-all', { method: 'POST' })
    reload()
  }
  return (
    <Popover>
      {/* ACESSIBILIDADE (varredura, item A8): sem total, o botão não tinha texto nenhum (leitor de
          tela anunciava só "botão"); com total, só o número solto, sem dizer do que é. O
          aria-label carrega o contexto; o número visual fica aria-hidden para não duplicar. */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative"
          aria-label={total > 0 ? `Notificações: ${total} pendente${total > 1 ? 's' : ''}` : 'Notificações'}
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span
              aria-hidden="true"
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
              <div className="text-[10px] text-slate-600 mt-1">{new Date(i.created_at).toLocaleString('pt-BR')}</div>
            </div>
          ))}
          {(!notif.items || notif.items.length === 0) && (
            <div className="p-4 text-sm text-slate-600 text-center">Sem notificações.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AdminTeams({ reload }) {
  const [teams, setTeams] = useState([])
  const [rejectId, setRejectId] = useState(null)
  const [justif, setJustif] = useState('')

  const load = useCallback(() => {
    api('/admin/teams').then((d) => setTeams(d.teams || [])).catch(() => {})
  }, [])
  useEffect(load, [load])

  const act = async (id, action, justification) => {
    try {
      await api(`/admin/teams/${id}/${action}`, { method: 'POST', body: { justification } })
      toastSuccess(action === 'approve' ? 'Equipe aprovada; e-mail colocado na fila' : 'Equipe recusada; e-mail colocado na fila')
      setRejectId(null)
      setJustif('')
      load()
      reload()
    } catch (e) {
      toastError(e.message)
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
        {teams.length === 0 && <p className="text-sm text-slate-600">Nenhuma equipe cadastrada.</p>}
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

function AdminAthletes({ reload }) {
  const [athletes, setAthletes] = useState([])
  const [rejectId, setRejectId] = useState(null)
  const [justif, setJustif] = useState('')

  const load = useCallback(() => {
    api('/admin/athletes').then((d) => setAthletes(d.athletes || [])).catch(() => {})
  }, [])
  useEffect(load, [load])

  const act = async (id, action, justification) => {
    try {
      await api(`/admin/athletes/${id}/${action}`, { method: 'POST', body: { justification } })
      toastSuccess(action === 'approve' ? 'Atleta liberado; e-mail colocado na fila' : 'Atleta recusado; e-mail colocado na fila')
      setRejectId(null)
      setJustif('')
      load()
      reload()
    } catch (e) {
      toastError(e.message)
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
        {athletes.length === 0 && <p className="text-sm text-slate-600">Nenhum atleta cadastrado.</p>}
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
