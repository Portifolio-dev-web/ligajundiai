'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
import { ATHLETE_POSITIONS, digitsOnly, formatCpf, isValidCpf } from '@/lib/athlete'

const steps = ['Conta e atleta', 'Equipe e biometria', 'Consentimento']

export default function CadastroAtletaPage() {
  const [step, setStep] = useState(0)
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', cpf: '', age: '', positions: [], consent: false })
  const [biometryKey, setBiometryKey] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api('/approved-teams', { signal: controller.signal })
      .then((result) => setTeams(result.teams))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoadingTeams(false))
    return () => controller.abort()
  }, [])

  const validCpf = useMemo(() => isValidCpf(form.cpf), [form.cpf])
  const approvedTeam = teams.find((item) => item.id === selectedTeamId) ?? null

  const togglePosition = (position, checked) => {
    setForm((current) => ({
      ...current,
      positions: checked
        ? [...current.positions, position]
        : current.positions.filter((item) => item !== position),
    }))
  }

  const canContinue = () => {
    if (step === 0) {
      if (form.name.trim().length < 2) return 'Informe o nome completo do atleta.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Informe um e-mail válido.'
      if (form.password.length < 12) return 'A senha deve ter pelo menos 12 caracteres.'
      if (!validCpf) return 'Informe um CPF válido.'
      if (form.age === '' || !Number.isInteger(Number(form.age)) || Number(form.age) < 0 || Number(form.age) > 120) return 'Informe uma idade válida.'
      if (form.positions.length === 0) return 'Selecione pelo menos uma posição.'
    }
    if (step === 1) {
      if (!approvedTeam) return 'Selecione uma equipe aprovada.'
      if (!biometryKey) return 'Capture e envie uma foto biométrica para continuar.'
    }
    return ''
  }

  const submit = async (event) => {
    event.preventDefault()
    const validationError = canContinue()
    if (validationError) {
      setError(validationError)
      return
    }
    if (!form.consent) {
      setError('O consentimento para o tratamento dos dados é obrigatório.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api('/athletes/self-register', {
        method: 'POST',
        body: {
          team_id: approvedTeam.id,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          cpf: digitsOnly(form.cpf),
          age: Number(form.age),
          positions: form.positions,
          biometry_key: biometryKey,
          consent: true,
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
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
        <span className="text-sm text-muted-foreground">Etapa {step + 1} de {steps.length}</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de atleta</CardTitle>
          <CardDescription>Preencha os dados em etapas. CPF e imagem são tratados com segurança.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2" aria-label="Etapas do formulário">
            {steps.map((title, index) => (
              <span key={title} className={`rounded-full px-3 py-1 text-xs ${index === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {index + 1}. {title}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error && <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            {step === 0 && <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="athlete-name">Nome completo</Label>
                <Input id="athlete-name" autoComplete="name" maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="athlete-email">E-mail para acessar sua conta</Label>
                  <Input id="athlete-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-password">Senha (mínimo de 12 caracteres)</Label>
                  <Input id="athlete-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="athlete-cpf">CPF</Label>
                  <Input id="athlete-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14} value={form.cpf} aria-invalid={form.cpf.length > 0 && !validCpf} onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })} required />
                  <p className="text-xs text-muted-foreground">{form.cpf.length > 0 ? validCpf ? 'CPF válido' : 'Confira os dígitos verificadores.' : 'O CPF será criptografado no banco de dados.'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="athlete-age">Idade</Label>
                  <Input id="athlete-age" type="number" min="0" max="120" step="1" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} required />
                </div>
              </div>
              <fieldset className="space-y-2">
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
              {loadingTeams
                ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando equipes aprovadas…</div>
                : teams.length
                  ? <div className="space-y-2">
                    <Label htmlFor="athlete-team">Equipe aprovada</Label>
                    <Select value={selectedTeamId} onValueChange={(teamId) => { setSelectedTeamId(teamId); setBiometryKey('') }}>
                      <SelectTrigger id="athlete-team"><SelectValue placeholder="Selecione sua equipe" /></SelectTrigger>
                      <SelectContent>
                        {teams.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — {item.category}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Somente equipes aprovadas pelo administrador aparecem para cadastro.</p>
                  </div>
                  : <Alert variant="destructive"><AlertTitle>Nenhuma equipe disponível</AlertTitle><AlertDescription>O cadastro de atletas será liberado quando um gestor inscrever uma equipe e ela for aprovada pelo administrador.</AlertDescription></Alert>}
              <CameraCapture key={selectedTeamId} teamId={approvedTeam?.id} onUploaded={setBiometryKey} disabled={!approvedTeam} publicRegistration />
            </div>}

            {step === 2 && <div className="space-y-5">
              <div className="rounded-md bg-muted p-4 text-sm">
                <p><strong>Atleta:</strong> {form.name}</p>
                <p><strong>E-mail da conta:</strong> {form.email}</p>
                <p><strong>CPF:</strong> {form.cpf}</p>
                <p><strong>Idade:</strong> {form.age}</p>
                <p><strong>Posições:</strong> {form.positions.map((position) => ATHLETE_POSITIONS.find((item) => item.value === position)?.label).join(', ')}</p>
                <p><strong>Equipe:</strong> {approvedTeam?.name} — {approvedTeam?.category}</p>
                <p><strong>Foto biométrica:</strong> {biometryKey ? 'Enviada com segurança' : 'Não enviada'}</p>
              </div>
              <label className="flex items-start gap-3 rounded-md border p-4 text-sm">
                <Checkbox checked={form.consent} onCheckedChange={(checked) => setForm({ ...form, consent: checked === true })} />
                <span>Autorizo o tratamento dos dados pessoais e da imagem para gestão esportiva e controle de acesso aos jogos, conforme a <Link className="underline" href="/privacidade" target="_blank">Política de Privacidade</Link>. Sei que posso solicitar acesso ou exclusão dos meus dados.</span>
              </label>
            </div>}

            <div className="flex items-center justify-between border-t pt-4">
              <Button type="button" variant="outline" onClick={() => { setError(''); setStep((current) => Math.max(0, current - 1)) }} disabled={step === 0 || submitting}>Voltar</Button>
              {step < steps.length - 1
                ? <Button type="button" onClick={() => {
                  const validationError = canContinue()
                  if (validationError) setError(validationError)
                  else { setError(''); setStep((current) => current + 1) }
                }}>Continuar <ArrowRight className="h-4 w-4" /></Button>
                : <Button type="submit" disabled={submitting || !form.consent || !biometryKey}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? 'Enviando cadastro…' : 'Concluir cadastro'}
                </Button>}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}