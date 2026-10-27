'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CalendarCheck, CalendarDays, LoaderCircle, TrendingUp } from 'lucide-react'
import HelpLink from '@/components/HelpLink'
import LogoutButton from '@/components/LogoutButton'
import { api } from '@/lib/lvjApi'
import { BLUE, NAVY, RED } from '@/lib/theme'

// PERFORMANCE/UX (redesign do painel do atleta, aprovado por mockup): antes era uma página única
// (componente MatchAttendance.jsx, hoje removido) sem cabeçalho de painel, misturando próximos
// jogos e histórico de presença numa tabela só. Agora segue o mesmo padrão do admin/gestor:
// cabeçalho próprio (com cards de resumo, igual aos do admin) + abas. "Próximos jogos" fica aqui
// (eager, aba padrão); "Presença" e "Classificação" moram em components/atleta/tabs/, carregadas
// sob demanda (next/dynamic).
function TabLoading() {
  return (
    <div className="mt-4 flex items-center justify-center rounded-lg border p-12 text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin mr-2" /> Carregando…
    </div>
  )
}

const AtletaPresenca = dynamic(() => import('@/components/atleta/tabs/AtletaPresenca'), { loading: TabLoading })
const AtletaClassificacao = dynamic(() => import('@/components/atleta/tabs/AtletaClassificacao'), { loading: TabLoading })

export default function AtletaPanel() {
  const [user, setUser] = useState(null)
  const [category, setCategory] = useState(null)
  const [matches, setMatches] = useState([])
  const [attendance, setAttendance] = useState([])
  const [minRequired, setMinRequired] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Levantado aqui (não dentro de cada aba) porque os cards "Próximo jogo" e "Frequência" no
  // cabeçalho também precisam dos mesmos dados — uma chamada só em vez de repetir em 3 lugares
  // (mesmo padrão já usado no GestorPanel para o elenco/contador de pendentes).
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const session = await api('/auth/me')
      if (session.user.role !== 'atleta') {
        throw new Error('Este painel não está disponível para seu perfil.')
      }
      setUser(session.user)
      const [athleteResult, matchResult, attendanceResult, rulesResult] = await Promise.all([
        api('/athletes/me'),
        api('/matches'),
        api('/attendance/athlete/mine'),
        api('/rules'),
      ])
      const athleteRecord = (athleteResult.athletes || []).find((a) => a.status === 'approved') ?? (athleteResult.athletes || [])[0] ?? null
      setCategory(athleteRecord?.category ?? null)
      setMatches(matchResult.matches || [])
      setAttendance(attendanceResult.attendance || [])
      setMinRequired(rulesResult.rules?.min_attendance_percent ?? null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Por DATA, não por status: o backend só marca status='finished' quando o admin lança o placar
  // manualmente (backend/src/routes/games.js) — um jogo que já aconteceu mas ainda sem placar
  // lançado ficaria preso em "Próximos jogos" para sempre se o corte fosse por status.
  const proximosJogos = matches.filter((m) => new Date(m.scheduled_at).getTime() > Date.now())
  const historico = matches.filter((m) => new Date(m.scheduled_at).getTime() <= Date.now())
  const proximoJogo = proximosJogos[0] ?? null

  const presentCount = attendance.filter((a) => a.present).length
  const frequenciaPercent = attendance.length ? Math.round((presentCount / attendance.length) * 100) : null
  const eligible = frequenciaPercent !== null && minRequired !== null ? frequenciaPercent >= minRequired : null

  return (
    // Esta é a home do painel do atleta (/atleta/jogos) — sem link para "/": Sair
    // (components/LogoutButton.jsx) é o único caminho de volta ao site público, para manter a
    // sessão protegida enquanto dentro do painel.
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-10">
      {/* flex-wrap: no mobile (375-390px) o título "Painel do Atleta" espremia contra Ajuda/Sair e
          quebrava em 2 linhas; com wrap, os botões descem para a linha de baixo em vez disso. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-1" style={{ color: NAVY }}>
            <CalendarCheck className="h-6 w-6" style={{ color: BLUE }} /> Painel do Atleta
            <Badge className="text-white border-0 text-xs" style={{ background: RED }}>Atleta</Badge>
          </h1>
          <p className="text-slate-500 text-sm">{user ? `Olá ${user.name}, acompanhe seus jogos e presença.` : 'Acompanhe seus jogos e presença.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpLink />
          <LogoutButton />
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertTitle>Não foi possível carregar os jogos</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Cards de resumo "à primeira vista", mesmo espírito dos StatCard do admin (ícone + valor +
          rótulo) — só que com conteúdo mais útil pro atleta do que uma contagem. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg text-white flex-shrink-0" style={{ background: BLUE }}>
              <CalendarDays className="h-5 w-5" />
            </div>
            {/* PERFORMANCE (mesmo achado da varredura do painel do gestor): min-h evita o salto de
                altura entre "Carregando…" e o conteúdo real (2 linhas quando há próximo jogo). */}
            <div className="min-w-0 min-h-[52px]">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximo jogo</div>
              {loading ? (
                <div className="text-sm text-slate-500">Carregando…</div>
              ) : proximoJogo ? (
                <>
                  <div className="font-bold text-slate-900 truncate">{proximoJogo.home_name} x {proximoJogo.away_name}</div>
                  <div className="text-xs text-slate-500">{new Date(proximoJogo.scheduled_at).toLocaleString('pt-BR')} {proximoJogo.venue ? `• ${proximoJogo.venue}` : ''}</div>
                </>
              ) : <div className="text-sm text-slate-600">Nenhum jogo agendado.</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg text-white flex-shrink-0" style={{ background: '#16a34a' }}>
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 min-h-[40px]">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frequência</div>
              {loading ? (
                <div className="text-sm text-slate-500">Carregando…</div>
              ) : frequenciaPercent === null ? (
                <div className="text-sm text-slate-600">Sem registros de presença ainda.</div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-slate-900">{frequenciaPercent}%</span>
                  {eligible !== null && (
                    <Badge className="text-white border-0 text-[10px]" style={{ background: eligible ? '#16a34a' : '#dc2626' }}>
                      {eligible ? `Apto (mín. ${minRequired}%)` : `Inapto (mín. ${minRequired}%)`}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PERFORMANCE/UX (mesma correção já aplicada no admin e no gestor): rolagem horizontal numa
          linha só em vez de quebrar no mobile. */}
      <Tabs defaultValue="proximos">
        <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto sm:w-fit">
          <TabsTrigger value="proximos" className="shrink-0">Próximos jogos</TabsTrigger>
          <TabsTrigger value="presenca" className="shrink-0">Presença</TabsTrigger>
          <TabsTrigger value="classificacao" className="shrink-0">Classificação</TabsTrigger>
        </TabsList>

        <TabsContent value="proximos">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Próximos jogos</CardTitle>
              <CardDescription>Agenda confirmada e aguardando confirmação da sua equipe.</CardDescription>
            </CardHeader>
            {/* PERFORMANCE (mesmo achado da varredura do painel do gestor): min-h evita o salto de
                altura entre o texto de carregamento e a tabela populada. */}
            <CardContent className="min-h-[200px]">
              {loading ? <p className="py-8 text-sm text-muted-foreground">Carregando jogos…</p> : <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {proximosJogos.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="font-medium">{match.home_name} × {match.away_name}</TableCell>
                        <TableCell>{new Date(match.scheduled_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{match.venue || '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{match.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {proximosJogos.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum jogo agendado.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presenca">
          <AtletaPresenca matches={historico} attendance={attendance} userName={user?.name} loading={loading} />
        </TabsContent>

        <TabsContent value="classificacao">
          <AtletaClassificacao category={category} />
        </TabsContent>
      </Tabs>
    </main>
  )
}
