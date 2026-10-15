'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, LoaderCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

export default function AthleteGamesPage() {
  const [matches, setMatches] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [matchResult, attendanceResult] = await Promise.all([
        api('/matches'),
        api('/attendance/athlete/mine'),
      ])
      setMatches(matchResult.matches || [])
      setAttendance(attendanceResult.attendance || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const attendanceByMatch = new Map(attendance.filter((record) => record.match_id).map((record) => [record.match_id, record]))
  const upcoming = matches.filter((match) =>
    ['proposed', 'confirmed', 'scheduled'].includes(match.status) && new Date(match.scheduled_at) >= new Date(),
  )
  const played = attendance.filter((record) => record.match_id)

  function downloadDeclaration(record) {
    const matchLabel = `${record.home_name || 'Partida'} x ${record.away_name || ''}`
    const date = formatAttendanceDate(record.attendance_date)
    const safe = (value) => String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character])
    const documentHtml = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Declaração de participação</title><body style="font:16px Arial,sans-serif;max-width:760px;margin:80px auto;line-height:1.7"><h1>Declaração de participação</h1><p>Declaramos, para os devidos fins, que o(a) atleta participou da partida <strong>${safe(matchLabel)}</strong>, realizada em ${safe(date)}.</p><p>Registro confirmado pelo controle de frequência da Liga de Voleibol Jundiaí.</p><p style="margin-top:100px">Liga de Voleibol Jundiaí</p><script>window.print()</script></body></html>`
    const url = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `declaracao-participacao-${record.attendance_date}.html`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Declaração preparada. Abra o arquivo para imprimir ou salvar em PDF.')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <Toaster position="top-right" richColors />
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Link>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Jogos e frequência</CardTitle><CardDescription>Veja a agenda e os registros de presença confirmados.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</Button>
          </CardHeader>
          <CardContent>
            {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            <h2 className="mb-3 font-semibold">Próximos jogos</h2>
            {loading ? <Loading /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead>Data e hora</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead><TableHead>Presença</TableHead></TableRow></TableHeader>
                <TableBody>
                  {upcoming.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">{match.home_name} × {match.away_name}</TableCell>
                      <TableCell>{new Date(match.scheduled_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{match.venue || '—'}</TableCell>
                      <TableCell>{match.status === 'proposed' ? 'Aguardando aceite' : match.status === 'confirmed' ? 'Confirmado' : 'Agendado'}</TableCell>
                      <TableCell>{attendanceByMatch.get(match.id)?.present ? 'Presente' : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!upcoming.length && <EmptyRow columns={5} message="Não há jogos futuros publicados." />}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Partidas realizadas</CardTitle><CardDescription>A declaração só fica disponível quando a presença foi confirmada pelo sistema de frequência.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <Loading /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead>Data</TableHead><TableHead>Presença</TableHead><TableHead className="text-right">Declaração</TableHead></TableRow></TableHeader>
                <TableBody>
                  {played.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.home_name || 'Partida'} × {record.away_name || ''}</TableCell>
                      <TableCell>{formatAttendanceDate(record.attendance_date)}</TableCell>
                      <TableCell>{record.present ? 'Presente' : 'Ausente'}</TableCell>
                      <TableCell className="text-right">
                        {record.present && new Date(`${record.attendance_date}T23:59:59`) < new Date()
                          ? <Button size="sm" variant="outline" onClick={() => downloadDeclaration(record)}><Download className="mr-2 h-4 w-4" /> Gerar declaração</Button>
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!played.length && <EmptyRow columns={4} message="Ainda não há frequência registrada em partidas." />}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function Loading() {
  return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…</div>
}

function EmptyRow({ columns, message }) {
  return <TableRow><TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">{message}</TableCell></TableRow>
}

function formatAttendanceDate(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}
