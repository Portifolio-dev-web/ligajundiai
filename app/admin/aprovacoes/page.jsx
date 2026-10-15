'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarIcon, Check, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_FALLBACK } from '@/lib/lvjApi'
import { api } from '@/lib/api'

export default function AdminAprovacoesPage() {
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null)
  const [justification, setJustification] = useState('')
  const [date, setDate] = useState()
  const [time, setTime] = useState('10:00')
  const [venue, setVenue] = useState('')
  const [category, setCategory] = useState(CATEGORY_FALLBACK[0])
  const [savingDate, setSavingDate] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [teamResult, athleteResult] = await Promise.all([
        api('/admin/teams?status=pending'),
        api('/admin/athletes?status=awaiting_admin'),
      ])
      setTeams(teamResult.teams || [])
      setAthletes(athleteResult.athletes || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function decide() {
    if (!action) return
    if (action.type === 'reject' && justification.trim().length < 3) {
      toast.error('Informe o motivo da recusa.')
      return
    }
    setWorking(true)
    try {
      await api(`/admin/${action.entity}/${action.record.id}/${action.type}`, {
        method: 'POST',
        body: { justification: justification.trim() },
      })
      toast.success(action.type === 'approve' ? 'Aprovação registrada.' : 'Recusa registrada.')
      setAction(null)
      setJustification('')
      await load()
    } catch (requestError) {
      toast.error(requestError.message)
    } finally {
      setWorking(false)
    }
  }

  async function createGameDate(event) {
    event.preventDefault()
    if (!date) {
      toast.error('Selecione uma data disponível.')
      return
    }
    const [hours, minutes] = time.split(':').map(Number)
    const availableAt = new Date(date)
    availableAt.setHours(hours, minutes, 0, 0)
    setSavingDate(true)
    try {
      await api('/admin/game-dates', {
        method: 'POST',
        body: { available_at: availableAt.toISOString(), category, venue: venue.trim() },
      })
      toast.success('Data disponível criada.')
      setDate(undefined)
      setVenue('')
    } catch (requestError) {
      toast.error(requestError.message)
    } finally {
      setSavingDate(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <Toaster position="top-right" richColors />
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Administração da liga</CardTitle>
              <CardDescription>Aprove equipes, faça a aprovação final de atletas e disponibilize datas de jogos.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            <Tabs defaultValue="teams">
              <TabsList className="grid h-auto w-full grid-cols-2">
                <TabsTrigger value="teams">Equipes pendentes ({teams.length})</TabsTrigger>
                <TabsTrigger value="athletes">Atletas aguardando admin ({athletes.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="teams">
                {loading ? <Loading /> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Equipe</TableHead><TableHead>Categoria</TableHead><TableHead>Gestor</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {teams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.category}</TableCell>
                          <TableCell>{team.manager_name}<br /><span className="text-xs text-muted-foreground">{team.manager_email}</span></TableCell>
                          <TableCell><Actions onApprove={() => setAction({ entity: 'teams', type: 'approve', record: team })} onReject={() => setAction({ entity: 'teams', type: 'reject', record: team })} /></TableCell>
                        </TableRow>
                      ))}
                      {!teams.length && <EmptyRow columns={4} message="Não há equipes pendentes." />}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="athletes">
                {loading ? <Loading /> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Atleta</TableHead><TableHead>Equipe</TableHead><TableHead>Gestor</TableHead><TableHead>Posições</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {athletes.map((athlete) => (
                        <TableRow key={athlete.id}>
                          <TableCell className="font-medium">{athlete.name}<br /><span className="text-xs text-muted-foreground">{athlete.cpf}</span></TableCell>
                          <TableCell>{athlete.team_name}<br /><span className="text-xs text-muted-foreground">{athlete.category}</span></TableCell>
                          <TableCell>{athlete.manager_name}</TableCell>
                          <TableCell>{(athlete.positions || []).join(', ')}</TableCell>
                          <TableCell><Actions onApprove={() => setAction({ entity: 'athletes', type: 'approve', record: athlete })} onReject={() => setAction({ entity: 'athletes', type: 'reject', record: athlete })} /></TableCell>
                        </TableRow>
                      ))}
                      {!athletes.length && <EmptyRow columns={5} message="Não há atletas aguardando aprovação final." />}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Criar data disponível para jogos</CardTitle>
            <CardDescription>Os gestores poderão propor e aceitar partidas para a categoria e data selecionadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createGameDate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))} locale={ptBR} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-time">Horário</Label>
                <Input id="game-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_FALLBACK.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-venue">Local (opcional)</Label>
                <Input id="game-venue" value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={200} />
              </div>
              <Button type="submit" disabled={savingDate || !date} className="sm:col-span-2 lg:col-span-4 lg:justify-self-end">
                {savingDate && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Criar data disponível
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !working) { setAction(null); setJustification('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.type === 'approve' ? 'Confirmar aprovação' : 'Confirmar recusa'}</DialogTitle>
            <DialogDescription>
              {action?.type === 'approve'
                ? `Aprovar “${action.record.name}”?`
                : `Recusar “${action?.record.name}”? Informe o motivo para registro e comunicação.`}
            </DialogDescription>
          </DialogHeader>
          {action?.type === 'reject' && <Textarea value={justification} onChange={(event) => setJustification(event.target.value)} maxLength={500} aria-label="Motivo da recusa" />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={working}>Cancelar</Button>
            <Button variant={action?.type === 'reject' ? 'destructive' : 'default'} onClick={decide} disabled={working || (action?.type === 'reject' && justification.trim().length < 3)}>
              {working && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function Loading() {
  return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…</div>
}

function Actions({ onApprove, onReject }) {
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" onClick={onApprove}><Check className="mr-1 h-4 w-4" /> Aprovar</Button>
      <Button size="sm" variant="destructive" onClick={onReject}><X className="mr-1 h-4 w-4" /> Rejeitar</Button>
    </div>
  )
}

function EmptyRow({ columns, message }) {
  return <TableRow><TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">{message}</TableCell></TableRow>
}
