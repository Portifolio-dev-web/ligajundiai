'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/lvjApi'
import { DANGER, GREEN } from '@/lib/theme'

export default function GestorFrequency({ token, teamId }) {
  const [data, setData] = useState({ attendance: [] })
  useEffect(() => {
    api('/attendance/mine', { token }).then(setData).catch(() => {})
  }, [token])
  // Risco 1 (varredura, análise LVJ 2027): /attendance/mine soma as equipes do gestor; aqui
  // filtramos para a equipe ativa no painel.
  const rows = (data.attendance || []).filter((item) => !teamId || item.team_id === teamId)
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Frequência (presença)</CardTitle>
        <CardDescription>Acompanhe a presença de cada atleta em relação à meta mínima da liga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((f) => (
          <div key={f.athlete_id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{f.name}</span>
              <Badge className="border-0 text-white" style={{ background: f.eligible ? GREEN : DANGER }}>
                {f.eligible ? `Apto (min ${f.min_required}%)` : `Inapto (min ${f.min_required}%)`}
              </Badge>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full" style={{ width: `${Math.min(f.percent, 100)}%`, background: f.eligible ? GREEN : DANGER }} />
            </div>
            <div className="text-xs text-slate-500 mt-1">{f.present}/{f.total_sessions} presenças • {f.percent}%</div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-600">Ainda não há registros de presença.</p>}
      </CardContent>
    </Card>
  )
}
