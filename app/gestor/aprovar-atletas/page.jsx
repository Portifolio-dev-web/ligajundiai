'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

export default function AprovarAtletasPage() {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [rejectId, setRejectId] = useState('')
  const [justification, setJustification] = useState('')
  const [error, setError] = useState('')
  const reasonInputRef = useRef(null)

  // ACESSIBILIDADE (varredura, item A4): ver o comentário em app/gestor/page.jsx.
  useEffect(() => { document.title = 'Aprovação de atletas | Liga de Voleibol Jundiaí (LVJ)' }, [])

  // ACESSIBILIDADE (varredura, item A9): clicar "Rejeitar" revela este campo, mas o foco ficava
  // parado no botão — quem usa teclado ou leitor de tela não percebia que um campo novo apareceu.
  useEffect(() => { if (rejectId) reasonInputRef.current?.focus() }, [rejectId])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/gestor/athletes?status=awaiting_manager')
      setAthletes(result.athletes || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const review = async (athleteId, action, reason = '') => {
    setBusyId(athleteId)
    setError('')
    try {
      await api(`/gestor/athletes/${athleteId}/${action}`, {
        method: 'POST',
        body: { justification: reason },
      })
      setRejectId('')
      setJustification('')
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js — faltava aqui, então o link não levava a lugar nenhum nesta tela.
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-10">
      <Button asChild variant="ghost"><Link href="/gestor"><ArrowLeft className="h-4 w-4" /> Painel do gestor</Link></Button>
      <Card>
        <CardHeader>
          <CardTitle>Aprovação de atletas</CardTitle>
          <CardDescription>Revise os cadastros vinculados à sua equipe. A aprovação encaminha o atleta para análise final do administrador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loading
            ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando solicitações…</div>
            : <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Atleta</TableHead><TableHead>Equipe</TableHead><TableHead>Idade</TableHead><TableHead>Posições</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {athletes.map((athlete) => (
                    <TableRow key={athlete.id}>
                      <TableCell className="font-medium">{athlete.name}</TableCell>
                      {/* Risco 1 (varredura, análise LVJ 2027): a fila agora junta as equipes do
                          gestor, então o nome da equipe evita confundir atletas de equipes diferentes. */}
                      <TableCell>{athlete.team_name ?? '—'}</TableCell>
                      <TableCell>{athlete.age_at_registration ?? '—'}</TableCell>
                      <TableCell>{(athlete.positions || []).join(', ') || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">Aguardando gestor</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => review(athlete.id, 'approve')} disabled={busyId === athlete.id}>
                            {busyId === athlete.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setRejectId(athlete.id); setJustification('') }} disabled={busyId === athlete.id}>
                            <X className="h-4 w-4" /> Rejeitar
                          </Button>
                        </div>
                        {rejectId === athlete.id && <div className="mt-3 flex items-end justify-end gap-2">
                          <div className="max-w-xs space-y-1 text-left">
                            <Label htmlFor={`reason-${athlete.id}`}>Motivo da rejeição</Label>
                            <Input ref={reasonInputRef} id={`reason-${athlete.id}`} value={justification} maxLength={500} onChange={(event) => setJustification(event.target.value)} />
                          </div>
                          <Button size="sm" variant="destructive" disabled={!justification.trim() || busyId === athlete.id} onClick={() => review(athlete.id, 'reject', justification)}>Confirmar</Button>
                        </div>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {athletes.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum atleta aguardando análise.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>}
        </CardContent>
      </Card>
    </main>
  )
}