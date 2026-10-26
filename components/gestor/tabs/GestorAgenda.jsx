'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/standings'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { BLUE } from '@/lib/theme'

export default function GestorAgenda({ category, token, team }) {
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState('all')
  const load = useCallback(() => {
    api(`/matches?category=${encodeURIComponent(category)}`).then((d) => setMatches(d.matches || [])).catch(() => {})
  }, [category])
  useEffect(load, [load])
  const accept = async (matchId) => {
    try {
      await api(`/gestor/matches/${matchId}/accept`, { method: 'POST', token, body: {} })
      toastSuccess('Aceite registrado.')
      load()
    } catch (e) {
      toastError(e.message)
    }
  }
  const filtered = matches.filter((m) => filter === 'all' || m.status === filter)
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agenda • {category}</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="proposed">Aguardando aceite</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="scheduled">Agendados</SelectItem>
              <SelectItem value="finished">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.map((m) => {
          const hs = (m.sets || []).filter((s) => s.home > s.away).length
          const as = (m.sets || []).filter((s) => s.away > s.home).length
          return (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <div className="font-semibold">
                  {m.home_name} <span className="text-slate-600">x</span> {m.away_name}
                  {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: BLUE }}>({hs}-{as})</span>}
                </div>
                <div className="text-xs text-slate-500">{new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                {m.status === 'proposed' && [m.home_team_id, m.away_team_id].includes(team?.id) && (
                  <Button size="sm" onClick={() => accept(m.id)}>Aceitar data</Button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-600">Nenhum jogo.</p>}
      </CardContent>
    </Card>
  )
}
