'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Bell, CalendarDays, Check, CheckCircle2, ClipboardList, LoaderCircle, Mail, Plus, Save,
  Settings, ShieldCheck, Trash2, Users, Volleyball, X, XCircle,
} from 'lucide-react'
import HelpLink from '@/components/HelpLink'
import LogoutButton from '@/components/LogoutButton'
import { StandingsTable, StatusBadge } from '@/components/standings'
import { toastSuccess, toastError } from '@/lib/toast'
import { api, CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { BLUE, NAVY, RED } from '@/lib/theme'

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
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="atletas">Atletas</TabsTrigger>
          <TabsTrigger value="jogos">Jogos & Resultados</TabsTrigger>
          <TabsTrigger value="datas">Datas disponíveis</TabsTrigger>
          <TabsTrigger value="presenca">Presença</TabsTrigger>
          <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
          <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
          <TabsTrigger value="classificacao">Classificação</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
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

// ---------------- RULES ENGINE ----------------
function RulesEngine() {
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/rules').then((d) => setRules(d.rules)).catch(() => {})
  }, [])

  if (!rules) return <p className="mt-4 text-slate-600">Carregando...</p>

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
      const d = await api('/rules', { method: 'PUT', body: rules })
      setRules(d.rules)
      toastSuccess('Regulamento salvo! A classificação será recalculada.')
    } catch (e) {
      toastError(e.message)
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
function AdminMatches({ categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
  const [resultMatch, setResultMatch] = useState(null)
  const [sets, setSets] = useState([{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }])

  const load = useCallback(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`).then((d) => setTeams(d.teams || [])).catch(() => {})
    api(`/matches?category=${encodeURIComponent(category)}`).then((d) => setMatches(d.matches || [])).catch(() => {})
  }, [category])
  useEffect(load, [load])

  const create = async () => {
    if (!form.home_team_id || !form.away_team_id || form.home_team_id === form.away_team_id) {
      toastError('Selecione duas equipes diferentes')
      return
    }
    try {
      await api('/admin/matches', { method: 'POST', body: form })
      toastSuccess('Jogo agendado')
      setForm({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
      load()
    } catch (e) {
      toastError(e.message)
    }
  }

  const saveResult = async () => {
    const clean = sets.filter((s) => s.home !== '' && s.away !== '')
    try {
      await api(`/admin/matches/${resultMatch.id}/result`, { method: 'PUT', body: { sets: clean.map((s) => ({ home: Number(s.home), away: Number(s.away) })) } })
      toastSuccess('Resultado salvo! Classificação atualizada.')
      setResultMatch(null)
      load()
    } catch (e) {
      toastError(e.message)
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
                    {m.home_name} <span className="text-slate-600">x</span> {m.away_name}
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
          {matches.length === 0 && <p className="text-sm text-slate-600">Nenhum jogo nesta categoria.</p>}
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

// ---------------- DATAS DISPONÍVEIS ----------------
// Antes era a rota dedicada /admin/agenda ("Gestão da Liga Jundiaí"). Cria uma data/local sugeridos
// para uma categoria; as equipes aceitam a sugestão depois (fluxo diferente do "Agendar" acima, que
// já cria o jogo direto entre duas equipes específicas).
function AdminGameDates({ categories }) {
  const todayDate = useMemo(() => new Date(), [])
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const [date, setDate] = useState()
  const [time, setTime] = useState('19:00')
  const [venue, setVenue] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!date || !category) {
      setError('Selecione a data e a categoria.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const availableAt = new Date(`${localDate(date)}T${time}:00`).toISOString()
      await api('/admin/game-dates', {
        method: 'POST',
        body: { available_at: availableAt, venue: venue.trim(), category },
      })
      setMessage('Data disponível criada com sucesso.')
      setVenue('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Criar data disponível</CardTitle><CardDescription>Defina uma sugestão de data e local para uma categoria. As equipes poderão aceitá-la ao ser proposta para um jogo.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert variant="destructive"><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert><AlertTitle>Concluído</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label>Data do jogo</Label>
            <Popover>
              <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start text-left font-normal"><CalendarDays className="h-4 w-4" />{date ? date.toLocaleDateString('pt-BR') : 'Selecione uma data'}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate())} initialFocus /></PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="game-time">Horário</Label><Input id="game-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></div>
            <div className="space-y-2"><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="game-venue">Local (opcional)</Label><Input id="game-venue" value={venue} maxLength={200} onChange={(event) => setVenue(event.target.value)} placeholder="Ginásio" /></div>
          <Button type="submit" disabled={saving || !date || !category}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Criar data disponível</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------------- ATTENDANCE ----------------
function AdminAttendance({ categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [athletes, setAthletes] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [present, setPresent] = useState({})
  const [freq, setFreq] = useState([])

  useEffect(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`).then((d) => setTeams(d.teams || [])).catch(() => {})
  }, [category])

  const loadTeam = useCallback((tid) => {
    setTeamId(tid)
    api('/admin/athletes?status=approved').then((d) => {
      const list = (d.athletes || []).filter((a) => a.team_id === tid)
      setAthletes(list)
      const init = {}
      list.forEach((a) => (init[a.id] = true))
      setPresent(init)
    })
    api(`/admin/attendance?team_id=${tid}`).then((d) => setFreq(d.attendance || [])).catch(() => {})
  }, [])

  const save = async () => {
    const records = athletes.map((a) => ({ athlete_id: a.id, present: !!present[a.id] }))
    try {
      await api('/admin/attendance', { method: 'POST', body: { team_id: teamId, date, records } })
      toastSuccess('Presença registrada')
      loadTeam(teamId)
    } catch (e) {
      toastError(e.message)
    }
  }

  const uploadSumula = async () => {
    try {
      await api('/admin/sumula', { method: 'POST', body: { team_id: teamId, category, date, filename: 'sumula_digitalizada.jpg' } })
      toastSuccess('Súmula importada (MOCKED - sem OCR real)')
    } catch (e) {
      toastError(e.message)
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
                  <span className="text-sm">{a.name} <span className="text-xs text-slate-600">RG {a.rg}</span></span>
                  <input type="checkbox" className="h-5 w-5" checked={!!present[a.id]} onChange={(e) => setPresent({ ...present, [a.id]: e.target.checked })} />
                </label>
              ))}
              {athletes.length === 0 && <p className="p-3 text-sm text-slate-600">Nenhum atleta aprovado nesta equipe.</p>}
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

// ---------------- INSCRIÇÕES ----------------
// Antes era a rota dedicada /admin/inscricoes ("Gestão da Liga Jundiaí").
const registrationKinds = [
  { value: 'team', label: 'Inscrição de equipes' },
  { value: 'athlete', label: 'Cadastro de atletas' },
]

const formatPeriodDate = (value) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Não configurado'

const toDateTimeLocal = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const registrationStatusLabels = {
  open: 'Inscrições abertas',
  scheduled: 'Abertura programada',
  closed: 'Encerrado',
  not_configured: 'Fechado · sem período configurado',
}

function AdminRegistrationPeriods() {
  const [periods, setPeriods] = useState([])
  const [category, setCategory] = useState(CATEGORY_FALLBACK[0])
  const [kind, setKind] = useState('team')
  const [form, setForm] = useState({ starts_at: '', ends_at: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/admin/registration-periods')
      setPeriods(result.periods || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const currentPeriod = useMemo(
    () => periods.find((period) => period.category === category && period.registration_type === kind),
    [category, kind, periods],
  )

  useEffect(() => {
    setForm({
      starts_at: toDateTimeLocal(currentPeriod?.starts_at),
      ends_at: toDateTimeLocal(currentPeriod?.ends_at),
    })
  }, [currentPeriod])

  useEffect(() => {
    setMessage('')
    setError('')
  }, [category, kind])

  const save = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!form.starts_at || !form.ends_at) {
      setError('Informe as datas e horários de início e término.')
      return
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError('A data final deve ser posterior à data inicial.')
      return
    }
    setSaving(true)
    try {
      await api(`/admin/registration-periods/${encodeURIComponent(category)}/${kind}`, {
        method: 'PUT',
        body: {
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
        },
      })
      setMessage(`Período de ${kind === 'team' ? 'inscrição de equipes' : 'cadastro de atletas'} salvo para ${category}.`)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const closePeriod = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await api(`/admin/registration-periods/${encodeURIComponent(category)}/${kind}`, { method: 'DELETE' })
      setMessage('Período removido. As inscrições ficarão fechadas até uma nova configuração.')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedStatus = currentPeriod?.status ?? 'not_configured'

  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Períodos de inscrição</CardTitle>
            <Badge variant={selectedStatus === 'open' ? 'default' : 'secondary'}>{registrationStatusLabels[selectedStatus]}</Badge>
          </div>
          <CardDescription>
            Configure datas independentes para inscrição de equipes e cadastro de atletas em cada categoria. Sem período configurado, as inscrições permanecem fechadas. O servidor aplica os limites mesmo que alguém tente enviar o formulário fora do prazo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="destructive"><AlertTitle>Não foi possível concluir</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert><AlertTitle>Atualização concluída</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-2">
              <Label htmlFor="registration-category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="registration-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_FALLBACK.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de inscrição</Label>
              <Tabs value={kind} onValueChange={setKind}>
                <TabsList className="grid w-full grid-cols-2">
                  {registrationKinds.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
                </TabsList>
                {registrationKinds.map((item) => <TabsContent key={item.value} value={item.value} className="sr-only">{item.label}</TabsContent>)}
              </Tabs>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-4">
            <p className="font-medium">{category} · {registrationKinds.find((item) => item.value === kind)?.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentPeriod
                ? `${formatPeriodDate(currentPeriod.starts_at)} — ${formatPeriodDate(currentPeriod.ends_at)}`
                : 'Nenhum período configurado. As inscrições estão fechadas.'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Os horários são interpretados no fuso local do administrador que configurar o período.</p>
          </div>

          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registration-start">Início</Label>
              <Input id="registration-start" type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-end">Término</Label>
              <Input id="registration-end" type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} required />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={loading || saving || !form.starts_at || !form.ends_at}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar período
              </Button>
              {currentPeriod && <Button type="button" variant="outline" onClick={closePeriod} disabled={saving}>
                <Trash2 className="h-4 w-4" /> Remover e fechar inscrições
              </Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Visão geral por categoria</CardTitle><CardDescription>O status é atualizado automaticamente conforme as datas configuradas.</CardDescription></CardHeader>
        <CardContent>
          {loading
            ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando períodos…</div>
            : <div className="space-y-4">
              {CATEGORY_FALLBACK.map((item) => (
                <section key={item} className="rounded-md border p-4">
                  <h2 className="mb-3 font-semibold">{item}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {registrationKinds.map((registrationKind) => {
                      const period = periods.find((entry) => entry.category === item && entry.registration_type === registrationKind.value)
                      const status = period?.status ?? 'not_configured'
                      return (
                        <div key={registrationKind.value} className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{registrationKind.label}</span>
                            <Badge variant={status === 'open' ? 'default' : 'secondary'}>{registrationStatusLabels[status]}</Badge>
                          </div>
                          <p className="text-muted-foreground">{period ? `${formatPeriodDate(period.starts_at)} — ${formatPeriodDate(period.ends_at)}` : 'Sem período configurado'}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminStandings({ categories }) {
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

function AdminCategories({ onCategoriesChanged }) {
  const [categories, setCategories] = useState([])
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [newForm, setNewForm] = useState({ name: '', abbreviation: '', sort_order: '' })
  const [creating, setCreating] = useState(false)
  // ACESSIBILIDADE (varredura, item A6): window.confirm nativo era a única ação irreversível do
  // app fora do padrão de diálogo real (AlertDialog já existia em components/ui, só não era usado
  // em lugar nenhum) — inconsistente, sem foco gerenciado nem leitura por leitor de tela como os
  // outros diálogos da aplicação.
  const [removeTarget, setRemoveTarget] = useState(null)

  const load = useCallback(() => {
    api('/admin/categories').then((d) => {
      const list = d.categories || []
      setCategories(list)
      setDrafts(Object.fromEntries(list.map((c) => [c.id, { name: c.name, abbreviation: c.abbreviation, sort_order: String(c.sort_order) }])))
    }).catch(() => {})
  }, [])
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
        body: { name: d.name.trim(), abbreviation: d.abbreviation.trim(), sort_order: Number(d.sort_order) || 0 },
      })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      toastSuccess('Categoria atualizada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  const toggleActive = async (cat) => {
    try {
      const { category } = await api(`/admin/categories/${cat.id}`, { method: 'PUT', body: { active: !cat.active } })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      toastSuccess(category.active ? 'Categoria ativada' : 'Categoria desativada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    }
  }

  const removeCategory = async (cat) => {
    try {
      await api(`/admin/categories/${cat.id}`, { method: 'DELETE' })
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      toastSuccess('Categoria removida')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    } finally {
      setRemoveTarget(null)
    }
  }

  const createCategory = async () => {
    if (!newForm.name.trim() || !newForm.abbreviation.trim()) {
      toastError('Informe nome e sigla da categoria')
      return
    }
    setCreating(true)
    try {
      const { category } = await api('/admin/categories', {
        method: 'POST',
        body: {
          name: newForm.name.trim(),
          abbreviation: newForm.abbreviation.trim(),
          sort_order: Number(newForm.sort_order) || (categories.length + 1),
        },
      })
      setCategories((prev) => [...prev, category].sort((a, b) => a.sort_order - b.sort_order))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      setNewForm({ name: '', abbreviation: '', sort_order: '' })
      toastSuccess('Categoria criada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
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
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setRemoveTarget(cat)} title="Remover categoria">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-600 py-8">Nenhuma categoria cadastrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a categoria &ldquo;{removeTarget?.name}&rdquo;? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeCategory(removeTarget)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function AdminEmails() {
  const [emails, setEmails] = useState([])
  useEffect(() => {
    api('/admin/emails').then((d) => setEmails(d.emails || [])).catch(() => {})
  }, [])
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
        {emails.length === 0 && <p className="text-sm text-slate-600">Nenhum e-mail enviado ainda.</p>}
      </CardContent>
    </Card>
  )
}

// ---------------- SEGURANÇA DA CONTA ----------------
// Antes era a rota dedicada /admin/seguranca ("Gestão da Liga Jundiaí").
// SEGURANÇA (varredura, item S21): antes o segredo TOTP do admin só vinha de ADMIN_TOTP_SECRET,
// regravado no banco a cada boot (backend/src/db/seed-admin.js) — esta aba é o fluxo de troca de
// verdade, pelo próprio admin, com prova de posse (código atual para começar, código novo para
// confirmar) e expiração de 10 minutos se não for concluído.
function AdminAccountSecurity() {
  // step: 'idle' | 'pending' | 'done'
  const [step, setStep] = useState('idle')
  const [currentTotp, setCurrentTotp] = useState('')
  const [newTotp, setNewTotp] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentTotpRef = useRef(null)
  const newTotpRef = useRef(null)

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
    <Card className="mt-4">
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
  )
}
