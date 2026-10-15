'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

export default function AprovarAtletasPage() {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null)
  const [justification, setJustification] = useState('')
  const [working, setWorking] = useState(false)

  const loadAthletes = useCallback(async () => {
    setError('')
    try {
      const result = await api('/athletes/mine')
      setAthletes((result.athletes || []).filter((athlete) => athlete.status === 'awaiting_manager'))
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAthletes() }, [loadAthletes])

  async function decide() {
    if (!action) return
    if (action.type === 'reject' && justification.trim().length < 3) {
      toast.error('Informe o motivo da recusa.')
      return
    }
    setWorking(true)
    try {
      await api(`/gestor/athletes/${action.athlete.id}/${action.type}`, {
        method: 'POST',
        body: { justification: justification.trim() },
      })
      toast.success(action.type === 'approve'
        ? 'Atleta aprovado e encaminhado ao administrador.'
        : 'Cadastro do atleta recusado.')
      setAction(null)
      setJustification('')
      await loadAthletes()
    } catch (requestError) {
      toast.error(requestError.message)
    } finally {
      setWorking(false)
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
              <CardTitle>Aprovação de atletas</CardTitle>
              <CardDescription>Revise os cadastros da sua equipe. A aprovação encaminha o atleta para a análise final do administrador.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadAthletes} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="destructive" className="mb-4"><AlertTitle>Falha ao carregar atletas</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Posições</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes.map((athlete) => (
                    <TableRow key={athlete.id}>
                      <TableCell className="font-medium">{athlete.name}</TableCell>
                      <TableCell>{athlete.cpf || '—'}</TableCell>
                      <TableCell>{(athlete.positions || []).join(', ') || athlete.position || '—'}</TableCell>
                      <TableCell>{new Date(athlete.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setAction({ type: 'approve', athlete })}>
                            <Check className="mr-1 h-4 w-4" /> Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setAction({ type: 'reject', athlete })}>
                            <X className="mr-1 h-4 w-4" /> Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {athletes.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Não há atletas aguardando sua aprovação.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !working) { setAction(null); setJustification('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.type === 'approve' ? 'Aprovar cadastro?' : 'Rejeitar cadastro?'}</DialogTitle>
            <DialogDescription>
              {action?.type === 'approve'
                ? `${action.athlete.name} será encaminhado para a aprovação final do administrador.`
                : `O atleta ${action?.athlete.name} será informado sobre a recusa.`}
            </DialogDescription>
          </DialogHeader>
          {action?.type === 'reject' && (
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className="text-sm font-medium">Motivo</label>
              <Textarea id="rejection-reason" value={justification} onChange={(event) => setJustification(event.target.value)} maxLength={500} />
              <p className="text-xs text-muted-foreground">{justification.length}/500 caracteres</p>
            </div>
          )}
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
