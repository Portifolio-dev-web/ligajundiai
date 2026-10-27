'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StandingsTable } from '@/components/standings'
import { api } from '@/lib/lvjApi'

// UX/PERFORMANCE (redesign do painel do atleta, aprovado por mockup): sempre a categoria da
// PRÓPRIA equipe do atleta (vinda de GET /athletes/me, que agora traz a categoria real da equipe
// via JOIN — ver backend/src/routes/athletes.js), nunca uma categoria assumida ou um valor
// padrão. Mesmo componente StandingsTable já usado na aba Classificação do gestor e do admin.
export default function AtletaClassificacao({ category }) {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!category) { setLoading(false); return }
    setLoading(true)
    api(`/standings?category=${encodeURIComponent(category)}`)
      .then((d) => setStandings(d.standings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [category])

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{category ? `Classificação • ${category}` : 'Classificação'}</CardTitle>
      </CardHeader>
      {/* PERFORMANCE (mesmo achado da varredura do painel do gestor): min-h evita o salto de altura
          entre o carregamento e a tabela populada. */}
      <CardContent className="p-0 min-h-[280px]">
        {!category ? (
          <p className="py-8 px-6 text-sm text-slate-600">Sua equipe ainda não tem uma categoria definida.</p>
        ) : loading ? (
          <p className="py-8 px-6 text-sm text-muted-foreground">Carregando classificação…</p>
        ) : (
          <StandingsTable standings={standings} category={category} />
        )}
      </CardContent>
    </Card>
  )
}
