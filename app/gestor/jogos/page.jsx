'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LogoutButton from '@/components/LogoutButton'
import HelpLink from '@/components/HelpLink'
import { api } from '@/lib/api'

export default function GestorJogosPage() {
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  // ACESSIBILIDADE (varredura, item A4): ver o comentário em app/gestor/page.jsx.
  useEffect(() => { document.title = 'Agenda de jogos | Liga de Voleibol Jundiaí (LVJ)' }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [teamResult, matchResult] = await Promise.all([api('/teams/mine'), api('/matches')])
      const myTeams = teamResult.teams || []
      setTeams(myTeams)
      const myTeamIds = new Set(myTeams.map((team) => team.id))
      setMatches((matchResult.matches || []).filter((match) =>
        myTeamIds.has(match.home_team_id) || myTeamIds.has(match.away_team_id),
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

  // Risco 1 (varredura, análise LVJ 2027): um gestor pode ter mais de uma equipe, então cada
  // jogo precisa dizer de qual das equipes do gestor ele é (a mesma equipe nunca joga contra
  // si mesma, então o nome da equipe do gestor já desambigua mandante/visitante).
  const teamById = new Map(teams.map((team) => [team.id, team]))

  return (
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js — faltava aqui, então o link não levava a lugar nenhum nesta tela.
    <main id="main-content" className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-10">
      {/* ACESSIBILIDADE (varredura, item A10): ver components/LogoutButton.jsx. UX (item O1): ver components/HelpLink.jsx */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost"><Link href="/gestor"><ArrowLeft className="h-4 w-4" /> Painel do gestor</Link></Button>
        <div className="flex items-center gap-2">
          <HelpLink />
          <LogoutButton />
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Agenda de jogos</CardTitle><CardDescription>{teams.length ? 'Sugestões envolvendo suas equipes. O jogo é confirmado quando os dois gestores aceitam.' : 'As sugestões de jogos das suas equipes aparecerão aqui.'}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {loading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando agenda…</div>
            : matches.length ? <div className="space-y-3">
              {matches.map((match) => {
                const myTeam = teamById.get(match.home_team_id) ?? teamById.get(match.away_team_id)
                const isHome = teamById.has(match.home_team_id)
                const alreadyAccepted = isHome ? !!match.home_accepted_at : !!match.away_accepted_at
                return <div key={match.id} className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{match.home_name} × {match.away_name}</p>
                    <p className="text-sm text-muted-foreground">{new Date(match.scheduled_at).toLocaleString('pt-BR')} · {match.venue || 'Local a definir'} · {match.category}</p>
                    {teams.length > 1 && myTeam && <p className="text-xs text-muted-foreground">Sua equipe: {myTeam.name}</p>}
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
            : <p className="py-6 text-center text-sm text-muted-foreground">Não há jogos propostos para suas equipes.</p>}
        </CardContent>
      </Card>
      <Button asChild variant="outline"><Link href="/jogos">Jogos e frequência</Link></Button>
    </main>
  )
}