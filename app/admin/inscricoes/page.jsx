'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { CATEGORY_FALLBACK } from '@/lib/lvjApi'

const registrationKinds = [
  { value: 'team', label: 'Inscrição de equipes' },
  { value: 'athlete', label: 'Cadastro de atletas' },
]

const formatDate = (value) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Não configurado'

const toDateTimeLocal = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const statusLabels = {
  open: 'Inscrições abertas',
  scheduled: 'Abertura programada',
  closed: 'Encerrado',
  not_configured: 'Fechado · sem período configurado',
}

export default function AdminInscricoesPage() {
  const [periods, setPeriods] = useState([])
  const [category, setCategory] = useState(CATEGORY_FALLBACK[0])
  const [kind, setKind] = useState('team')
  const [form, setForm] = useState({ starts_at: '', ends_at: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // ACESSIBILIDADE (varredura, item A4): ver o comentário em app/gestor/page.jsx.
  useEffect(() => { document.title = 'Períodos de inscrição | Liga de Voleibol Jundiaí (LVJ)' }, [])

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
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js — faltava aqui, então o link não levava a lugar nenhum nesta tela.
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link href="/admin/aprovacoes"><ArrowLeft className="h-4 w-4" /> Aprovações</Link></Button>
        <Badge variant={selectedStatus === 'open' ? 'default' : 'secondary'}>{statusLabels[selectedStatus]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Períodos de inscrição</CardTitle>
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
                ? `${formatDate(currentPeriod.starts_at)} — ${formatDate(currentPeriod.ends_at)}`
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
                            <Badge variant={status === 'open' ? 'default' : 'secondary'}>{statusLabels[status]}</Badge>
                          </div>
                          <p className="text-muted-foreground">{period ? `${formatDate(period.starts_at)} — ${formatDate(period.ends_at)}` : 'Sem período configurado'}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>}
        </CardContent>
      </Card>
    </main>
  )
}
