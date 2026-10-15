'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export default function GestorJogosPage() {
  const [team, setTeam] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [teamResult, matchResult] = await Promise.all([api('/teams/mine'), api('/matches')])
      setTeam(teamResult.team)
      setMatches((matchResult.matches || []).filter((match) =>
        match.home_team_id === teamResult.team?.id || match.away_team_id === teamResult.team?.id,
      ))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const accept = async (matchId) => {
    setBusyId(matchId)
    setError('')
    try {
      await api(`/gestor/matches/${matchId}/accept`, { method: 'POST', body: {} })
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-10">
      <Button asChild variant="ghost"><Link href="/gestor"><ArrowLeft className="h-4 w-4" /> Painel do gestor</Link></Button>
      <Card>
        <CardHeader><CardTitle>Agenda de jogos</CardTitle><CardDescription>{team ? `Sugestões envolvendo ${team.name}. O jogo é confirmado quando os dois gestores aceitam.` : 'As sugestões de jogos da sua equipe aparecerão aqui.'}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando agenda…</div>
            : matches.length ? <div className="space-y-3">
              {matches.map((match) => {
                const isHome = match.home_team_id === team?.id
                const alreadyAccepted = isHome ? !!match.home_accepted_at : !!match.away_accepted_at
                return <div key={match.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{match.home_name} × {match.away_name}</p>
                    <p className="text-sm text-muted-foreground">{new Date(match.scheduled_at).toLocaleString('pt-BR')} · {match.venue || 'Local a definir'} · {match.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={match.status === 'confirmed' ? 'default' : 'secondary'}>{match.status === 'proposed' ? 'Aguardando aceite' : match.status}</Badge>
                    {match.status === 'proposed' && (alreadyAccepted
                      ? <span className="text-sm text-muted-foreground">Seu aceite foi registrado</span>
                      : <Button size="sm" onClick={() => accept(match.id)} disabled={busyId === match.id}>
                        {busyId === match.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aceitar data
                      </Button>)}
                  </div>
                </div>
              })}
            </div>
            : <p className="py-6 text-center text-sm text-muted-foreground">Não há jogos propostos para a sua equipe.</p>}
        </CardContent>
      </Card>
      <Button asChild variant="outline"><Link href="/jogos">Jogos e frequência</Link></Button>
    </main>
  )
}