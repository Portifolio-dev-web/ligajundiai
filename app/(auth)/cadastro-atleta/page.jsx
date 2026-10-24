'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CameraCapture from '@/components/CameraCapture'
import { api } from '@/lib/api'
import { ATHLETE_POSITIONS, formatRg, isValidRg } from '@/lib/athlete'
import { IMAGE_USE_TERM, MINOR_GUARDIAN_TERM } from '@/lib/legalTerms'

const steps = ['Conta e atleta', 'Equipe e biometria', 'Consentimento']

export default function CadastroAtletaPage() {
  const [step, setStep] = useState(0)
  const [teams, setTeams] = useState([])
  const [registrationPeriods, setRegistrationPeriods] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  // LGPD (varredura, item L2): guardianName/guardianRg/guardianRelationship só são obrigatórios
  // quando a idade informada for menor de 18 anos (ver isMinor abaixo).
  const [form, setForm] = useState({
    name: '', email: '', password: '', rg: '', age: '', positions: [], consent: false,
    // LGPD (varredura, item L4): biometricConsent é um consentimento separado do geral (consent) —
    // a foto é dado sensível (art. 11, I) e precisa de aceite específico e destacado.
    biometricConsent: false,
    guardianName: '', guardianRg: '', guardianRelationship: '',
  })
  const [biometryKey, setBiometryKey] = useState('')
  // ACESSIBILIDADE (varredura, item A12): qual campo falhou na última validação — usado para
  // aria-invalid/aria-describedby e para mover o foco até ele (ver focusField/canContinue abaixo).
  // Sem isso, quem usa teclado ou leitor de tela só ouvia uma mensagem genérica no topo e tinha que
  // caçar manualmente qual campo estava errado.
  const [invalidField, setInvalidField] = useState('')
  const fieldRefs = useRef({})
  const registerField = (key) => (el) => { fieldRefs.current[key] = el }
  const focusField = (key) => { fieldRefs.current[key]?.focus() }

  // ACESSIBILIDADE (varredura, item A4): ver o comentário em app/gestor/page.jsx.
  useEffect(() => { document.title = 'Cadastro de atleta | Liga de Voleibol Jundiaí (LVJ)' }, [])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api('/approved-teams', { signal: controller.signal }),
      api('/registration-periods', { signal: controller.signal }),
    ])
      .then(([teamResult, periodResult]) => {
        setTeams(teamResult.teams)
        setRegistrationPeriods(periodResult.periods || [])
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoadingTeams(false))
    return () => controller.abort()
  }, [])

  const validRg = useMemo(() => isValidRg(form.rg), [form.rg])
  // LGPD (varredura, item L2): 18 é o corte de maioridade civil usado também no backend
  // (createAthlete, backend/src/routes/athletes.js) — as duas pontas precisam concordar.
  const isMinor = form.age !== '' && Number.isInteger(Number(form.age)) && Number(form.age) < 18
  const validGuardianRg = useMemo(() => isValidRg(form.guardianRg), [form.guardianRg])
  const approvedTeam = teams.find((item) => item.id === selectedTeamId) ?? null
  const openAthletePeriods = registrationPeriods.filter((period) => (
    period.registration_type === 'athlete' && period.status === 'open'
  ))
  const upcomingAthletePeriods = registrationPeriods.filter((period) => (
    period.registration_type === 'athlete' && period.status === 'scheduled'
  ))

  const togglePosition = (position, checked) => {
    setForm((current) => ({
      ...current,
      positions: checked
        ? [...current.positions, position]
        : current.positions.filter((item) => item !== position),
    }))
  }

  // ACESSIBILIDADE (varredura, item A12): cada checagem agora diz também QUAL campo falhou (field),
  // não só a mensagem — field é o nome usado em invalidField/registerField/focusField acima, para
  // marcar aria-invalid no campo certo e mover o foco até ele.
  const canContinue = () => {
    if (step === 0) {
      if (form.name.trim().length < 2) return { message: 'Informe o nome completo do atleta.', field: 'name' }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return { message: 'Informe um e-mail válido.', field: 'email' }
      if (form.password.length < 12) return { message: 'A senha deve ter pelo menos 12 caracteres.', field: 'password' }
      if (!validRg) return { message: 'Informe um RG válido.', field: 'rg' }
      if (form.age === '' || !Number.isInteger(Number(form.age)) || Number(form.age) < 0 || Number(form.age) > 120) return { message: 'Informe uma idade válida.', field: 'age' }
      if (form.positions.length === 0) return { message: 'Selecione pelo menos uma posição.', field: 'positions' }
      // LGPD (varredura, item L2): menor de idade precisa do responsável legal identificado — não
      // basta marcar uma caixinha, igual o backend (createAthlete) também passou a exigir.
      if (isMinor) {
        if (form.guardianName.trim().length < 2) return { message: 'Informe o nome completo do responsável legal.', field: 'guardianName' }
        if (!validGuardianRg) return { message: 'Informe um RG válido para o responsável legal.', field: 'guardianRg' }
        if (form.guardianRelationship.trim().length < 2) return { message: 'Informe o grau de parentesco do responsável legal.', field: 'guardianRelationship' }
      }
    }
    if (step === 1) {
      if (!approvedTeam) return { message: 'Selecione uma equipe aprovada.', field: 'team' }
      if (!biometryKey) return { message: 'Capture e envie uma foto biométrica para continuar.', field: '' }
    }
    return null
  }

  // ACESSIBILIDADE (varredura, item A12): centraliza o que acontecia espalhado em 3 lugares
  // (canContinue + submit) — seta a mensagem, marca o campo inválido e move o foco até ele.
  const applyValidationError = (validationError) => {
    setError(validationError.message)
    setInvalidField(validationError.field)
    if (validationError.field) focusField(validationError.field)
  }

  const submit = async (event) => {
    event.preventDefault()
    const validationError = canContinue()
    if (validationError) {
      applyValidationError(validationError)
      return
    }
    if (!form.consent) {
      setError('O consentimento para o tratamento dos dados é obrigatório.')
      setInvalidField('')
      return
    }
    // LGPD (varredura, item L4): consentimento específico da biometria, além do geral acima.
    if (!form.biometricConsent) {
      setError('O consentimento específico para o tratamento da foto biométrica é obrigatório.')
      setInvalidField('')
      return
    }
    setError('')
    setInvalidField('')
    setSubmitting(true)
    try {
      await api('/athletes/self-register', {
        method: 'POST',
        body: {
          team_id: approvedTeam.id,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          rg: formatRg(form.rg),
          age: Number(form.age),
          positions: form.positions,
          biometry_key: biometryKey,
          consent: true,
          biometric_consent: true,
          // LGPD (varredura, item L2): só enviados quando isMinor; o backend rejeita o cadastro de
          // um menor sem esses três campos (GUARDIAN_REQUIRED).
          ...(isMinor ? {
            guardian_name: form.guardianName.trim(),
            guardian_rg: formatRg(form.guardianRg),
            guardian_relationship: form.guardianRelationship.trim(),
          } : {}),
        },
      })
      setCreated(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      // ACESSIBILIDADE (varredura, item A1): alvo do link "Pular para o conteúdo" (app/layout.js)
      <main id="main-content" className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Cadastro enviado</CardTitle>
            <CardDescription>A conta foi criada e o cadastro de {form.name} está aguardando a aprovação do gestor de {approvedTeam?.name}.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Voltar ao início</Link></Button></CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
        {!loadingTeams && teams.length > 0 && <span className="text-sm text-muted-foreground">Etapa {step + 1} de {steps.length}</span>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de atleta</CardTitle>
          <CardDescription>
            {loadingTeams
              ? 'Verificando as equipes aprovadas para o cadastro.'
              : error && teams.length === 0
                ? 'Não foi possível carregar as equipes neste momento.'
                : teams.length === 0
                ? openAthletePeriods.length
                  ? 'O cadastro só começa quando uma equipe da categoria estiver aprovada.'
                  : upcomingAthletePeriods.length
                    ? 'As inscrições de atletas ainda não começaram.'
                    : 'O período de cadastro de atletas está encerrado.'
                  : 'Preencha os dados em etapas. RG e imagem são tratados com segurança.'}
          </CardDescription>
          {/* PERFORMANCE (varredura, item I-Média-2): esta linha de etapas só aparecia depois que
              /approved-teams respondia, empurrando o CardContent abaixo para baixo nesse instante
              (CLS). "invisible" mantém a altura reservada desde o primeiro paint, sem mostrar nada
              enquanto loadingTeams/teams ainda não chegaram. */}
          <div className={`flex flex-wrap gap-2 pt-2 ${teams.length > 0 ? '' : 'invisible'}`} aria-hidden={teams.length === 0} aria-label={teams.length > 0 ? 'Etapas do formulário' : undefined}>
            {steps.map((title, index) => (
              <span key={title} className={`rounded-full px-3 py-1 text-xs ${index === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {index + 1}. {title}
              </span>
            ))}
          </div>
        </CardHeader>
        {/* PERFORMANCE (varredura, item I-Média-2): min-h amortece o salto entre o indicador de
            carregamento (uma linha) e o formulário completo (bem mais alto) quando /approved-teams
            responde — sem isso, o card "pulava" de altura logo após o primeiro paint. */}
        <CardContent className="min-h-[560px]">
          {loadingTeams
            ? <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando equipes aprovadas…</div>
            : teams.length === 0
              ? error
                ? <div className="space-y-4">
                  <Alert variant="destructive"><AlertTitle>Não foi possível verificar as equipes</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
                  <Button type="button" variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
                </div>
                : <div className="space-y-4">
                  <Alert>
                      {openAthletePeriods.length
                        ? <>
                          <AlertTitle>Nenhuma equipe disponível</AlertTitle>
                          <AlertDescription>Há inscrições de atletas abertas, mas nenhuma equipe aprovada está disponível para essas categorias. Peça ao gestor para inscrever a equipe e aguarde a aprovação do administrador.</AlertDescription>
                        </>
                        : upcomingAthletePeriods.length
                          ? <>
                            <AlertTitle>Inscrições ainda não iniciaram</AlertTitle>
                            <AlertDescription>
                              {upcomingAthletePeriods.map((period) => (
                                <span key={period.category} className="block">
                                  {period.category}: início em {new Date(period.starts_at).toLocaleString('pt-BR')}.
                                </span>
                              ))}
                            </AlertDescription>
                          </>
                          : <>
                            <AlertTitle>Cadastro encerrado</AlertTitle>
                            <AlertDescription>Obrigado pelo interesse em participar, Cadastro encerrado.</AlertDescription>
                          </>}
                    </Alert>
                    <div className="flex flex-wrap gap-2">
                      {openAthletePeriods.length > 0 && <Button variant="outline" asChild><Link href="/">Ver opções de acesso</Link></Button>}
                      <Button type="button" variant="outline" onClick={() => window.location.reload()}>Verificar novamente</Button>
                    </div>
                  </div>
              : <form onSubmit={submit} className="space-y-6">
            {/* ACESSIBILIDADE (varredura, item A12): id usado em aria-describedby dos campos
                marcados inválidos abaixo — associa a mensagem de erro ao campo específico. */}
            {error && <Alert id="form-error" variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            {step === 0 && <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="athlete-name">Nome completo</Label>
                <Input ref={registerField('name')} id="athlete-name" autoComplete="name" maxLength={120} value={form.name} aria-invalid={invalidField === 'name'} aria-describedby={invalidField === 'name' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="athlete-email">E-mail para acessar sua conta</Label>
                  <Input ref={registerField('email')} id="athlete-email" type="email" autoComplete="email" maxLength={254} value={form.email} aria-invalid={invalidField === 'email'} aria-describedby={invalidField === 'email' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-password">Senha (mínimo de 12 caracteres)</Label>
                  <Input ref={registerField('password')} id="athlete-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} aria-invalid={invalidField === 'password'} aria-describedby={invalidField === 'password' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="athlete-rg">RG</Label>
                  <Input ref={registerField('rg')} id="athlete-rg" inputMode="text" autoComplete="off" placeholder="00.000.000-0" maxLength={12} value={form.rg} aria-invalid={invalidField === 'rg' || (form.rg.length > 0 && !validRg)} aria-describedby={invalidField === 'rg' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, rg: formatRg(event.target.value) })} required />
                  <p className="text-xs text-muted-foreground">{form.rg.length > 0 ? validRg ? 'RG válido' : 'Confira o número informado.' : 'O RG será criptografado no banco de dados.'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-age">Idade</Label>
                  <Input ref={registerField('age')} id="athlete-age" type="number" min="0" max="120" step="1" value={form.age} aria-invalid={invalidField === 'age'} aria-describedby={invalidField === 'age' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, age: event.target.value })} required />
                </div>
              </div>

              {/* LGPD (varredura, item L2): aparece só quando a idade informada é menor de 18 —
                  art. 14 da LGPD exige o consentimento do responsável legal, identificado. */}
              {isMinor && <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">Como o atleta é menor de idade, precisamos dos dados do responsável legal.</p>
                <div className="space-y-2">
                  <Label htmlFor="guardian-name">Nome completo do responsável</Label>
                  <Input ref={registerField('guardianName')} id="guardian-name" autoComplete="off" maxLength={120} value={form.guardianName} aria-invalid={invalidField === 'guardianName'} aria-describedby={invalidField === 'guardianName' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guardian-rg">RG do responsável</Label>
                    <Input ref={registerField('guardianRg')} id="guardian-rg" inputMode="text" autoComplete="off" placeholder="00.000.000-0" maxLength={12} value={form.guardianRg} aria-invalid={invalidField === 'guardianRg' || (form.guardianRg.length > 0 && !validGuardianRg)} aria-describedby={invalidField === 'guardianRg' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, guardianRg: formatRg(event.target.value) })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardian-relationship">Parentesco</Label>
                    <Input ref={registerField('guardianRelationship')} id="guardian-relationship" placeholder="mãe, pai, tutor(a)…" maxLength={60} value={form.guardianRelationship} aria-invalid={invalidField === 'guardianRelationship'} aria-describedby={invalidField === 'guardianRelationship' ? 'form-error' : undefined} onChange={(event) => setForm({ ...form, guardianRelationship: event.target.value })} required />
                  </div>
                </div>
              </div>}

              {/* ACESSIBILIDADE (varredura, item A12): tabIndex={-1} deixa o fieldset focável só por
                  JS (focusField), não pelo Tab — não é um campo de formulário, é só o alvo do foco
                  quando "Selecione pelo menos uma posição" falha. */}
              <fieldset ref={registerField('positions')} tabIndex={-1} aria-invalid={invalidField === 'positions'} aria-describedby={invalidField === 'positions' ? 'form-error' : undefined} className="space-y-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <legend className="text-sm font-medium">Posições (selecione uma ou mais)</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ATHLETE_POSITIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                      <Checkbox checked={form.positions.includes(value)} onCheckedChange={(checked) => togglePosition(value, checked === true)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>}

            {step === 1 && <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="athlete-team">Equipe aprovada</Label>
                <Select value={selectedTeamId} onValueChange={(teamId) => { setSelectedTeamId(teamId); setBiometryKey('') }}>
                  <SelectTrigger ref={registerField('team')} id="athlete-team" aria-invalid={invalidField === 'team'} aria-describedby={invalidField === 'team' ? 'form-error' : undefined}><SelectValue placeholder="Selecione sua equipe" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — {item.category}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Somente equipes aprovadas pelo administrador aparecem para cadastro.</p>
              </div>
              <CameraCapture key={selectedTeamId} teamId={approvedTeam?.id} onUploaded={setBiometryKey} disabled={!approvedTeam} publicRegistration />
            </div>}

            {step === 2 && <div className="space-y-5">
              <div className="rounded-md bg-muted p-4 text-sm">
                <p><strong>Atleta:</strong> {form.name}</p>
                <p><strong>E-mail da conta:</strong> {form.email}</p>
                <p><strong>RG:</strong> {form.rg}</p>
                <p><strong>Idade:</strong> {form.age}</p>
                <p><strong>Posições:</strong> {form.positions.map((position) => ATHLETE_POSITIONS.find((item) => item.value === position)?.label).join(', ')}</p>
                <p><strong>Equipe:</strong> {approvedTeam?.name} — {approvedTeam?.category}</p>
                <p><strong>Foto biométrica:</strong> {biometryKey ? 'Enviada com segurança' : 'Não enviada'}</p>
                {isMinor && <p><strong>Responsável legal:</strong> {form.guardianName} ({form.guardianRelationship})</p>}
              </div>
              {/* Risco 3 (análise LVJ 2027): texto real do Termo de Autorização de Uso de Imagem
                  (todo atleta) e, quando menor de idade, também da Autorização para Participação
                  de Atletas Menores — não mais o aceite genérico de dados. */}
              {isMinor && <div className="rounded-md border bg-amber-50 p-4 text-xs text-amber-900">{MINOR_GUARDIAN_TERM}</div>}
              <div className="rounded-md border bg-muted p-4 text-xs text-muted-foreground">{IMAGE_USE_TERM}</div>
              {/* LGPD (varredura, item L4): checkbox separado do consentimento geral abaixo — a foto
                  biométrica é dado sensível (art. 11, I) e exige consentimento específico e destacado,
                  não só implícito no aceite da Política/Termos. */}
              <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
                <Checkbox checked={form.biometricConsent} onCheckedChange={(checked) => setForm({ ...form, biometricConsent: checked === true })} />
                <span>Autorizo especificamente o tratamento da minha foto biométrica para o controle de acesso aos jogos (reconhecimento facial), como dado pessoal sensível (art. 11 da LGPD).</span>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-4 text-sm">
                <Checkbox checked={form.consent} onCheckedChange={(checked) => setForm({ ...form, consent: checked === true })} />
                {/* LGPD (varredura, item L1): agora linka também os Termos de Uso, não só a Política de Privacidade */}
                <span>Li e aceito {isMinor ? 'os termos acima' : 'o termo acima'}, conforme a <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link> e os <Link className="underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>. Sei que posso solicitar acesso ou exclusão dos meus dados.</span>
              </label>
            </div>}

            <div className="flex items-center justify-between border-t pt-4">
              <Button type="button" variant="outline" onClick={() => { setError(''); setInvalidField(''); setStep((current) => Math.max(0, current - 1)) }} disabled={step === 0 || submitting}>Voltar</Button>
              {step < steps.length - 1
                ? <Button type="button" onClick={() => {
                  const validationError = canContinue()
                  if (validationError) applyValidationError(validationError)
                  else { setError(''); setInvalidField(''); setStep((current) => current + 1) }
                }}>Continuar <ArrowRight className="h-4 w-4" /></Button>
                : <Button type="submit" disabled={submitting || !form.consent || !form.biometricConsent || !biometryKey}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? 'Enviando cadastro…' : 'Concluir cadastro'}
                </Button>}
            </div>
          </form>}
        </CardContent>
      </Card>
    </main>
  )
}