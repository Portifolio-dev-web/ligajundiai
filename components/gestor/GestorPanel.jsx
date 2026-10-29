'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toastSuccess, toastError } from '@/lib/toast'
import { Users, UserPlus, LoaderCircle } from 'lucide-react'
import { api } from '@/lib/lvjApi'
import { formatRg, getAge, isValidRg } from '@/lib/athlete'
import { financialResponsibilityTerm, IMAGE_USE_TERM, MINOR_GUARDIAN_TERM } from '@/lib/legalTerms'
import { BLUE, RED, NAVY } from '@/lib/theme'
import { StatusBadge } from '@/components/standings'

// PERFORMANCE (varredura, item I2): este painel morava embutido em app/page.js, no mesmo bundle
// servido a todo visitante anônimo da home — hoje é carregado via next/dynamic (ver app/page.js)
// e só baixado por quem realmente está logado como gestor.
// PERFORMANCE (mesma correção do item 6 da varredura, aplicada aqui em escala menor): das 4 abas,
// só "Elenco" (a mais usada) fica neste arquivo — Frequência/Classificação/Agenda viram chunks
// próprios em components/gestor/tabs/, carregados sob demanda ao clicar na aba.
function TabLoading() {
  return (
    <div className="mt-4 flex items-center justify-center rounded-lg border p-12 text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin mr-2" /> Carregando…
    </div>
  )
}

const GestorFrequency = dynamic(() => import('@/components/gestor/tabs/GestorFrequency'), { loading: TabLoading })
const GestorStandings = dynamic(() => import('@/components/gestor/tabs/GestorStandings'), { loading: TabLoading })
const GestorAgenda = dynamic(() => import('@/components/gestor/tabs/GestorAgenda'), { loading: TabLoading })
const GestorApproveAthletes = dynamic(() => import('@/components/gestor/tabs/GestorApproveAthletes'), { loading: TabLoading })

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

  // UX (redesign do painel, aprovado por mockup): o elenco agora é carregado aqui, não mais dentro
  // de GestorRoster — tanto a aba Elenco quanto a nova aba "Aprovar atletas" (fila só de
  // pendentes) precisam da mesma lista, e o número de pendentes também vira o contador da aba.
  // Uma chamada só em vez de duas evita refazer a mesma requisição em dois componentes.
  const [athletes, setAthletes] = useState([])
  const loadAthletes = useCallback(() => {
    if (!activeTeam) return
    api(`/athletes/mine?team_id=${activeTeam.id}`, { token }).then((d) => setAthletes(d.athletes || [])).catch(() => {})
  }, [token, activeTeam])
  useEffect(() => { loadAthletes() }, [loadAthletes])
  const pendingAthleteCount = athletes.filter((a) => a.status === 'awaiting_manager').length

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

          {/* PERFORMANCE/UX (redesign do painel, mesma correção aplicada no /admin): com 5 abas —
              uma a mais desde que "Aprovar atletas" entrou — a faixa ganha rolagem horizontal numa
              linha só em vez de quebrar em várias linhas no mobile; shrink-0 em cada aba evita que
              o texto fique espremido dentro do contêiner que rola. */}
          <Tabs defaultValue="elenco" key={activeTeam.id}>
            <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="elenco" className="shrink-0">Elenco</TabsTrigger>
              <TabsTrigger value="aprovar-atletas" className="shrink-0 gap-1.5">
                Aprovar atletas
                {pendingAthleteCount > 0 && (
                  <span
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: RED }}
                  >
                    {pendingAthleteCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="frequencia" className="shrink-0">Frequência</TabsTrigger>
              <TabsTrigger value="agenda" className="shrink-0">Agenda</TabsTrigger>
              <TabsTrigger value="classificacao" className="shrink-0">Classificação</TabsTrigger>
            </TabsList>
            <TabsContent value="elenco"><GestorRoster token={token} team={activeTeam} athletes={athletes} reload={loadAthletes} /></TabsContent>
            <TabsContent value="aprovar-atletas"><GestorApproveAthletes token={token} athletes={athletes} reload={loadAthletes} /></TabsContent>
            <TabsContent value="frequencia"><GestorFrequency token={token} teamId={activeTeam.id} /></TabsContent>
            <TabsContent value="agenda"><GestorAgenda category={activeTeam.category} token={token} team={activeTeam} /></TabsContent>
            <TabsContent value="classificacao"><GestorStandings token={token} category={activeTeam.category} /></TabsContent>
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

function GestorRoster({ token, team, athletes, reload }) {
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
  // ACESSIBILIDADE (varredura, item A12): erro de cadastro de atleta só existia como toast — sem
  // foco movido nem campo marcado, quem usa teclado/leitor de tela não sabia onde corrigir.
  const [addError, setAddError] = useState('')
  const nameInputRef = useRef(null)

  // Mesmo corte de idade do backend (createAthlete, MINOR_AGE_LIMIT em backend/src/routes/athletes.js),
  // calculado a partir da data de nascimento, para decidir se mostra os campos do responsável legal.
  const athleteAge = getAge(form.birthdate)
  const isMinor = athleteAge !== null && athleteAge < 18
  const validGuardianRg = isValidRg(form.guardianRg)

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
      reload()
    } catch (e) {
      setAddError(e.message)
      nameInputRef.current?.focus()
      toastError(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Elenco</CardTitle>
        <CardDescription>Os cadastros passam primeiro pela aprovação do gestor e depois pela aprovação final do administrador.</CardDescription>
      </CardHeader>
      {/* PERFORMANCE (achado ao escrever o teste e2e desta rodada — mesma correção do item 5 da
          varredura original): "Verificando o período…" (uma linha) virava o formulário completo
          de cadastro assim que loadingAthletePeriod resolvia, sem altura reservada — um salto
          grande o bastante para empurrar o rodapé da página inteira (CLS medido: ~0,43, acima do
          limite "bom" de 0,1). min-h absorve a troca. */}
      <CardContent className="space-y-4 min-h-[420px]">
        {team.status === 'approved' && loadingAthletePeriod ? (
          <div role="status" className="rounded-lg border p-3 text-sm text-slate-600">Verificando o período de cadastro de atletas…</div>
        ) : team.status === 'approved' && athletePeriod?.status === 'open' ? (
          // UX (auditoria de leis de UX, Lei de Miller/Carga cognitiva, Fase 3): eram 11+ campos
          // visíveis ao mesmo tempo num grid único. Agrupados em 3 seções colapsáveis — só "Dados
          // do atleta" abre por padrão, as outras ficam disponíveis a um clique quando precisar.
          <div className="rounded-lg border bg-slate-50 p-4">
            <Accordion type="single" collapsible defaultValue="dados" className="w-full">
              <AccordionItem value="dados">
                <AccordionTrigger>Dados do atleta</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3 md:grid-cols-3 items-end">
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
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="documentos">
                <AccordionTrigger>Documentação e biometria</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Foto para biometria (máx. 5 MB)</Label>
                      <Input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setForm({ ...form, photo: e.target.files?.[0] || null })} />
                    </div>
                    {/* LGPD (varredura, item L2): aparece só quando a data de nascimento indica menor de
                        18 anos — art. 14 da LGPD exige o consentimento do responsável legal, identificado. */}
                    {isMinor && <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
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
                    {/* LGPD (varredura, item L4): checkbox separado do consentimento geral abaixo, só exigido
                        quando há foto anexada — a biometria é dado sensível (art. 11 da LGPD). */}
                    {form.photo && <label className="flex items-start gap-2 text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <input type="checkbox" checked={form.biometricConsent} onChange={(e) => setForm({ ...form, biometricConsent: e.target.checked })} />
                      <span>Confirmo o consentimento específico do atleta (ou responsável legal) para o tratamento da foto biométrica para controle de acesso (reconhecimento facial), como dado pessoal sensível (art. 11 da LGPD).</span>
                    </label>}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="termos" className="border-b-0">
                <AccordionTrigger>Termos e consentimento</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {/* Risco 3 (análise LVJ 2027): texto real do Termo de Autorização de Uso de Imagem
                        (todo atleta) e, quando menor de idade, também da Autorização para Participação de
                        Atletas Menores — não mais o aceite genérico de dados. */}
                    {isMinor && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{MINOR_GUARDIAN_TERM}</div>}
                    <div className="rounded-md border bg-white p-3 text-xs text-slate-600">{IMAGE_USE_TERM}</div>
                    <label className="flex items-start gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                      <span>Confirmo que obtive o consentimento do atleta (ou responsável legal) para os termos acima e para tratar os dados e a foto biométrica, conforme a <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link> e os <Link className="underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>.</span>
                    </label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {addError && <p id="add-athlete-error" role="alert" className="mt-3 text-xs text-red-600">{addError}</p>}
            <Button
              className="mt-4 text-white border-0"
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
                {/* UX (auditoria de leis de UX, Lei de Occam/Lei de Jakob, Fase 2): aprovar/recusar
                    saiu daqui — era a mesma ação duplicada em 3 lugares diferentes (ver
                    components/gestor/tabs/GestorApproveAthletes.jsx). O Elenco agora só mostra o
                    status; a ação vive num único lugar, a aba "Aprovar atletas". */}
                {a.status === 'awaiting_manager' && <div className="text-xs text-slate-500">Revise na aba &ldquo;Aprovar atletas&rdquo;.</div>}
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {athletes.length === 0 && <p className="text-sm text-slate-600">Nenhum atleta no elenco.</p>}
        </div>
      </CardContent>
    </Card>
  )
}
