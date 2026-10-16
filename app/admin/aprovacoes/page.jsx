'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'

export default function AdminAprovacoesPage() {
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [reject, setReject] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [teamResult, athleteResult] = await Promise.all([
        api('/admin/teams?status=pending'),
        api('/admin/athletes?status=awaiting_admin'),
      ])
      setTeams(teamResult.teams || [])
      setAthletes(athleteResult.athletes || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const review = async (kind, itemId, action, justification = '') => {
    setBusyId(itemId)
    setError('')
    try {
      await api(`/admin/${kind}/${itemId}/${action}`, { method: 'POST', body: { justification } })
      setReject(null)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const renderRows = (items, kind) => items.length ? items.map((item) => (
    <TableRow key={item.id}>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{kind === 'teams' ? item.category : `${item.team_name} · ${(item.positions || []).join(', ')}`}</TableCell>
      <TableCell>{kind === 'teams' ? item.manager_name : item.manager_name}</TableCell>
      <TableCell><Badge variant="secondary">{kind === 'teams' ? 'Pendente' : 'Aguardando administrador'}</Badge></TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => review(kind, item.id, 'approve')} disabled={busyId === item.id}>
            {busyId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setReject({ kind, id: item.id, name: item.name, reason: '' })}>
            <X className="h-4 w-4" /> Rejeitar
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma aprovação pendente.</TableCell></TableRow>

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link href="/"><ArrowLeft className="h-4 w-4" /> Página inicial</Link></Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/inscricoes">Períodos de inscrição</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/agenda">Criar datas disponíveis</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Aprovações pendentes</CardTitle><CardDescription>Analise as equipes cadastradas e os atletas já aprovados pelos gestores.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {reject && <div className="space-y-2 rounded-md border p-4">
            <Label htmlFor="reject-reason">Motivo para rejeitar “{reject.name}”</Label>
            <div className="flex flex-wrap gap-2">
              <Input id="reject-reason" className="min-w-64 flex-1" maxLength={500} value={reject.reason} onChange={(event) => setReject({ ...reject, reason: event.target.value })} />
              <Button variant="destructive" disabled={!reject.reason.trim() || !!busyId} onClick={() => review(reject.kind, reject.id, 'reject', reject.reason)}>Confirmar rejeição</Button>
              <Button variant="outline" onClick={() => setReject(null)}>Cancelar</Button>
            </div>
          </div>}
          {loading
            ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando pendências…</div>
            : <Tabs defaultValue="teams">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="teams">Equipes pendentes ({teams.length})</TabsTrigger>
                <TabsTrigger value="athletes">Atletas pendentes ({athletes.length})</TabsTrigger>
              </TabsList>
              {[['teams', 'Equipe / Categoria'], ['athletes', 'Equipe / Posições']].map(([kind, secondColumn]) => (
                <TabsContent key={kind} value={kind}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>{secondColumn}</TableHead><TableHead>Gestor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>{renderRows(kind === 'teams' ? teams : athletes, kind)}</TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>}
        </CardContent>
      </Card>
    </main>
  )
}