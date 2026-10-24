'use client'

import Link from 'next/link'
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toastSuccess, toastError } from '@/lib/toast'
import { Users, CalendarDays, UserPlus } from 'lucide-react'
import { api } from '@/lib/lvjApi'
import { formatRg, getAge, isValidRg } from '@/lib/athlete'
import { financialResponsibilityTerm, IMAGE_USE_TERM, MINOR_GUARDIAN_TERM } from '@/lib/legalTerms'
import { BLUE, RED, NAVY } from '@/lib/theme'
import { StandingsTable, StatusBadge } from '@/components/standings'

// PERFORMANCE (varredura, item I2): este painel morava embutido em app/page.js, no mesmo bundle
// servido a todo visitante anônimo da home — hoje é carregado via next/dynamic (ver app/page.js)
// e só baixado por quem realmente está logado como gestor.
// ============================================================================
// GESTOR PANEL
// ============================================================================
export default function GestorPanel({ token, categories, user, myTeams, refreshMe }) {
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
            <Label htmlFor="gestor-team-name">Nome da equipe</Label>
            <Input id="gestor-team-name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="gestor-team-category">Categoria</Label>
            <Select value={teamForm.category} onValueChange={(v) => setTeamForm({ ...teamForm, category: v })}>
              <SelectTrigger id="gestor-team-category"><SelectValue /></SelectTrigger>
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
                quando há foto anexada — a biometria é dado sensível (art. 11 da LGPD). */}
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
