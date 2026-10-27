'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'

// UX/PERFORMANCE (redesign do painel do gestor, aprovado por mockup): antes vivia na rota
// dedicada /gestor/aprovar-atletas (ainda existe, só não tem mais link no menu) — esta aba é a
// mesma fila, só de pendentes, só que no estilo de linha já usado no Elenco (não uma <Table>),
// para ficar visualmente consistente com as outras abas do painel. A aba Elenco continua
// aprovando/recusando inline também (decisão do usuário: manter os dois jeitos).
export default function GestorApproveAthletes({ token, athletes, reload }) {
  const [rejectId, setRejectId] = useState(null)
  const [justification, setJustification] = useState('')

  const pending = athletes.filter((a) => a.status === 'awaiting_manager')

  const review = async (id, action, reason = '') => {
    try {
      await api(`/gestor/athletes/${id}/${action}`, { method: 'POST', token, body: { justification: reason } })
      toastSuccess(action === 'approve' ? 'Atleta encaminhado para aprovação final.' : 'Cadastro do atleta recusado.')
      setRejectId(null)
      setJustification('')
      reload()
    } catch (e) {
      toastError(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Aprovação de atletas</CardTitle>
        <CardDescription>Revise os cadastros vinculados à sua equipe. A aprovação encaminha o atleta para análise final do administrador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="text-sm">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-slate-500">RG {a.rg} {a.position ? `• ${a.position}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => review(a.id, 'approve')}>Aprovar</Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectId(a.id)}>Recusar</Button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-slate-600">Nenhum atleta aguardando análise.</p>}
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
