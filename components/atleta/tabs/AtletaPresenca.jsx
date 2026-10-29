'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText } from 'lucide-react'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function printDeclaration(match, attendance) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita a abertura de uma janela para gerar a declaração.')
  }
  const title = `${match.home_name} x ${match.away_name}`
  printWindow.document.open()
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Declaração de participação</title><style>body{font:16px/1.6 Arial,sans-serif;max-width:760px;margin:80px auto;padding:24px;color:#172033}h1{text-align:center}p{margin:1.5em 0}.sign{text-align:center;margin-top:90px}@media print{body{margin:30mm auto}}</style></head><body><h1>Declaração de Participação</h1><p>Declaramos, para os devidos fins, que o(a) atleta <strong>${escapeHtml(attendance.athlete_name || 'atleta registrado')}</strong> esteve presente na partida <strong>${escapeHtml(title)}</strong>, realizada em ${escapeHtml(new Date(match.scheduled_at).toLocaleDateString('pt-BR'))}.</p><p>Presença confirmada por registro eletrônico de acesso.</p><p class="sign">Liga de Voleibol Jundiaí</p><script>window.onload=()=>window.print()</script></body></html>`)
  printWindow.document.close()
}

// UX/PERFORMANCE (redesign do painel do atleta, aprovado por mockup): só os jogos já ocorridos
// (scheduled_at <= agora), com presença e declaração. matches/attendance/loading vêm do painel
// (components/atleta/AtletaPanel.jsx) — levantados lá porque os cards "Próximo jogo" e
// "Frequência" no cabeçalho também precisam dos mesmos dados, então uma chamada só evita refazer
// a mesma requisição em dois lugares (mesmo padrão já usado no GestorPanel).
export default function AtletaPresenca({ matches, attendance, userName, loading }) {
  const [error, setError] = useState('')

  const attendanceByMatch = new Map(attendance.filter((item) => item.match_id).map((item) => [item.match_id, item]))

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Presença</CardTitle>
        <CardDescription>Jogos que já aconteceram. Declarações ficam disponíveis após a confirmação de presença no jogo.</CardDescription>
      </CardHeader>
      {/* PERFORMANCE (mesmo achado da varredura do painel do gestor): min-h evita o salto de altura
          entre o texto de carregamento e a tabela populada. */}
      <CardContent className="min-h-[280px]">
        {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
        {loading ? <p className="py-8 text-sm text-muted-foreground">Carregando jogos…</p> : <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Presença</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {matches.map((match) => {
                const record = attendanceByMatch.get(match.id)
                return <TableRow key={match.id}>
                  <TableCell className="font-medium">{match.home_name} × {match.away_name}</TableCell>
                  <TableCell>{new Date(match.scheduled_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{match.venue || '—'}</TableCell>
                  <TableCell>{record?.present ? <Badge>Presente</Badge> : 'Não registrada'}</TableCell>
                  {/* UX (auditoria de leis de UX, Lei de Fitts): era um link de texto sublinhado
                      (~14px de alvo de toque) na ação mais procurada desta tela — agora um botão
                      real, com área de toque adequada. */}
                  <TableCell>{record?.present && <Button type="button" size="sm" variant="outline" onClick={() => {
                    try { printDeclaration(match, { ...record, athlete_name: userName }) } catch (printError) { setError(printError.message) }
                  }}><FileText className="h-4 w-4" /> Gerar declaração</Button>}</TableCell>
                </TableRow>
              })}
              {matches.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum jogo realizado ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>}
      </CardContent>
    </Card>
  )
}
