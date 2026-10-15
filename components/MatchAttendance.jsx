'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

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

export default function MatchAttendance({ expectedRole }) {
  const [user, setUser] = useState(null)
  const [team, setTeam] = useState(null)
  const [matches, setMatches] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const session = await api('/auth/me')
      if (expectedRole && session.user.role !== expectedRole) {
        throw new Error('Este painel não está disponível para seu perfil.')
      }
      setUser(session.user)
      const [matchResult, extra] = await Promise.all([
        api('/matches'),
        session.user.role === 'atleta'
          ? api('/attendance/athlete/mine')
          : Promise.all([api('/teams/mine'), api('/attendance/mine')]),
      ])
      setMatches(matchResult.matches || [])
      if (session.user.role === 'atleta') setAttendance(extra.attendance || [])
      else {
        setTeam(extra[0].team)
        setAttendance(extra[1].attendance || [])
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [expectedRole])

  useEffect(() => { load() }, [load])

  const visibleMatches = user?.role === 'gestor' && team
    ? matches.filter((match) => match.home_team_id === team.id || match.away_team_id === team.id)
    : user?.role === 'gestor' ? [] : matches
  const attendanceByMatch = new Map(attendance.filter((item) => item.match_id).map((item) => [item.match_id, item]))

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <Card>
        <CardHeader><CardTitle>Jogos e frequência</CardTitle><CardDescription>Confira a agenda da sua equipe e os registros de presença. Declarações ficam disponíveis após a confirmação de presença no jogo.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Não foi possível carregar os jogos</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loading ? <p className="py-8 text-sm text-muted-foreground">Carregando jogos…</p> : <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead><TableHead>Presença</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {visibleMatches.map((match) => {
                  const record = attendanceByMatch.get(match.id)
                  const past = new Date(match.scheduled_at).getTime() <= Date.now()
                  return <TableRow key={match.id}>
                    <TableCell className="font-medium">{match.home_name} × {match.away_name}</TableCell>
                    <TableCell>{new Date(match.scheduled_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{match.venue || '—'}</TableCell>
                    <TableCell><Badge variant={match.status === 'finished' ? 'default' : 'secondary'}>{match.status}</Badge></TableCell>
                    <TableCell>{user?.role === 'atleta' ? record?.present ? 'Presente' : past ? 'Não registrada' : '—' : 'Consulte a frequência da equipe'}</TableCell>
                    <TableCell>{user?.role === 'atleta' && past && record?.present && <button type="button" className="text-sm font-medium text-primary underline" onClick={() => {
                      try { printDeclaration(match, { ...record, athlete_name: user.name }) } catch (printError) { setError(printError.message) }
                    }}>Gerar declaração</button>}</TableCell>
                  </TableRow>
                })}
                {visibleMatches.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum jogo disponível.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>}
        </CardContent>
      </Card>
    </main>
  )
}
