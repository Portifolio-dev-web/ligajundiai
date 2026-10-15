'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Volleyball } from 'lucide-react'
import CameraCapture from '@/components/CameraCapture'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ATHLETE_POSITIONS, ageFromBirthdate, formatCpf, isValidCpf } from '@/lib/athlete'
import { api } from '@/lib/api'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

const steps = ['Dados pessoais', 'Equipe e posições', 'Consentimento e foto']

export default function CadastroAtletaPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [accountRole, setAccountRole] = useState('')
  const [managerTeam, setManagerTeam] = useState(null)
  const [approvedTeams, setApprovedTeams] = useState([])
  const [biometryKey, setBiometryKey] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [sensitiveConsent, setSensitiveConsent] = useState(false)
  const [form, setForm] = useState({
    name: '',
    cpf: '',
    birthdate: '',
    email: '',
    teamId: '',
    positions: [],
  })

  useEffect(() => {
    let active = true
    Promise.all([api('/auth/me'), api('/teams/approved')])
      .then(async ([session, approved]) => {
        if (!active) return
        setAccountRole(session.user.role)
        setApprovedTeams(approved.teams || [])
        setForm((current) => ({
          ...current,
          name: current.name || session.user.name || '',
          email: current.email || session.user.email || '',
        }))
        if (session.user.role === 'gestor') {
          const mine = await api('/teams/mine')
          if (!active) return
          setManagerTeam(mine.team)
          if (mine.team?.status === 'approved') setForm((current) => ({ ...current, teamId: mine.team.id }))
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selectableTeams = useMemo(() => {
    if (accountRole === 'atleta') return approvedTeams
    if (accountRole === 'gestor' && managerTeam?.status === 'approved') {
      return approvedTeams.filter((team) => team.id === managerTeam.id)
    }
    return []
  }, [accountRole, approvedTeams, managerTeam])
  const age = ageFromBirthdate(form.birthdate)
  const cpfValid = isValidCpf(form.cpf)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function togglePosition(value, checked) {
    setForm((current) => ({
      ...current,
      positions: checked
        ? [...current.positions, value]
        : current.positions.filter((position) => position !== value),
    }))
  }

  function nextStep() {
    setError('')
    if (step === 0) {
      if (form.name.trim().length < 2) return setError('Informe o nome completo do atleta.')
      if (!cpfValid) return setError('Confira o CPF; os dígitos verificadores não são válidos.')
      if (age === null || age < 0 || age > 120) return setError('Informe uma data de nascimento válida.')
    }
    if (step === 1) {
      if (!selectableTeams.some((team) => team.id === form.teamId)) return setError('Selecione uma equipe aprovada.')
      if (!form.positions.length) return setError('Selecione pelo menos uma posição.')
    }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!termsAccepted || !sensitiveConsent) {
      setError('É necessário aceitar os Termos de Uso e o consentimento para dados sensíveis.')
      return
    }
    setSubmitting(true)
    try {
      await api(accountRole === 'atleta' ? '/athletes/self-register' : '/athletes', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          cpf: form.cpf,
          birthdate: form.birthdate,
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          positions: form.positions,
          ...(accountRole === 'atleta' ? { team_id: form.teamId } : {}),
          consent: true,
          ...(biometryKey ? { biometry_key: biometryKey } : {}),
        },
      })
      toast.success(accountRole === 'atleta'
        ? 'Cadastro enviado para aprovação do gestor da equipe.'
        : 'Cadastro enviado para aprovação do gestor.')
      router.push(accountRole === 'atleta' ? '/atleta/jogos' : '/gestor/aprovar-atletas')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Toaster position="top-right" richColors />
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Voltar para a Liga
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Volleyball className="h-6 w-6 text-violet-700" /> Cadastro de atleta
            </CardTitle>
            <CardDescription>
              {accountRole === 'atleta'
                ? 'Escolha uma equipe aprovada e envie seu cadastro para análise do gestor.'
                : 'Preencha as etapas para enviar o cadastro à aprovação do gestor.'}
            </CardDescription>
            <ol className="grid grid-cols-3 gap-2 pt-3" aria-label="Etapas do cadastro">
              {steps.map((label, index) => (
                <li key={label} aria-current={step === index ? 'step' : undefined}
                  className={`rounded-md px-2 py-2 text-center text-xs ${step === index ? 'bg-violet-100 font-semibold text-violet-900' : 'bg-slate-100 text-slate-500'}`}>
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-5"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando equipes aprovadas…</div>
            ) : !['gestor', 'atleta'].includes(accountRole) ? (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível validar sua conta</AlertTitle>
                <AlertDescription>{error || 'Entre novamente com uma conta de gestor ou atleta para continuar.'}</AlertDescription>
              </Alert>
            ) : accountRole === 'gestor' && managerTeam?.status !== 'approved' ? (
              <Alert><AlertTitle>Equipe ainda não aprovada</AlertTitle><AlertDescription>O cadastro de atletas fica disponível depois da aprovação da equipe pelo administrador.</AlertDescription></Alert>
            ) : (
              <form onSubmit={submit} className="space-y-6">
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="athlete-name">Nome completo</Label>
                      <Input id="athlete-name" autoComplete="name" value={form.name} onChange={(event) => update('name', event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="athlete-cpf">CPF</Label>
                      <Input id="athlete-cpf" inputMode="numeric" autoComplete="off" value={form.cpf}
                        onChange={(event) => update('cpf', formatCpf(event.target.value))}
                        aria-invalid={form.cpf.length > 13 && !cpfValid} placeholder="000.000.000-00" required />
                      {form.cpf.length > 13 && !cpfValid && <p className="text-sm text-destructive">CPF inválido.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="athlete-birthdate">Data de nascimento</Label>
                      <Input id="athlete-birthdate" type="date" value={form.birthdate}
                        onChange={(event) => update('birthdate', event.target.value)} required />
                      {age !== null && age >= 0 && <p className="text-xs text-muted-foreground">Idade calculada: {age} anos.</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="athlete-email">E-mail (opcional)</Label>
                      <Input id="athlete-email" type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>{accountRole === 'atleta' ? 'Equipe' : 'Equipe aprovada'}</Label>
                      <Select value={form.teamId} onValueChange={(value) => update('teamId', value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione sua equipe" /></SelectTrigger>
                        <SelectContent>
                          {selectableTeams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name} · {team.category}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectableTeams.length === 0 && <p className="text-sm text-destructive">Nenhuma equipe aprovada disponível para sua conta.</p>}
                    </div>
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium">Posições (selecione uma ou mais)</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {ATHLETE_POSITIONS.map((position) => (
                          <label key={position.value} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                            <Checkbox checked={form.positions.includes(position.value)}
                              onCheckedChange={(checked) => togglePosition(position.value, checked === true)} />
                            {position.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <section className="space-y-3 rounded-lg border p-4">
                      <h2 className="font-semibold">Consentimentos obrigatórios</h2>
                      <label className="flex items-start gap-3 text-sm">
                        <Checkbox checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} />
                        <span>Li e aceito os <Link className="text-violet-700 underline" href="/termos-de-uso" target="_blank">Termos de Uso</Link>.</span>
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <Checkbox checked={sensitiveConsent} onCheckedChange={(checked) => setSensitiveConsent(checked === true)} />
                        <span>Consinto com o tratamento do CPF e, se enviada, da imagem biométrica, conforme a <Link className="text-violet-700 underline" href="/privacidade" target="_blank">Política de Privacidade</Link>.</span>
                      </label>
                    </section>
                    <section className="space-y-3 rounded-lg border p-4">
                      <div>
                        <h2 className="font-semibold">Foto para reconhecimento facial (opcional)</h2>
                        <p className="text-sm text-muted-foreground">Use a câmera para capturar e enviar a foto diretamente ao armazenamento.</p>
                      </div>
                      <CameraCapture teamId={form.teamId} disabled={!termsAccepted || !sensitiveConsent || !form.teamId || submitting}
                        onUploaded={({ key }) => setBiometryKey(key)}
                        onError={(captureError) => setError(captureError.message)} />
                      {biometryKey && <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Foto anexada ao cadastro.</p>}
                    </section>
                  </div>
                )}

                <div className="flex justify-between border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => { setError(''); setStep((current) => Math.max(current - 1, 0)) }} disabled={step === 0 || submitting}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  {step < steps.length - 1 ? (
                    <Button type="button" onClick={nextStep}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  ) : (
                    <Button type="submit" disabled={submitting || !termsAccepted || !sensitiveConsent}>
                      {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Enviar cadastro
                    </Button>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
