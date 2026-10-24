'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StandingsTable } from '@/components/standings'
import { api } from '@/lib/lvjApi'

export default function AdminStandings({ categories }) {
  const [category, setCategory] = useState(categories[0])
  const [standings, setStandings] = useState([])
  useEffect(() => {
    api(`/standings?category=${encodeURIComponent(category)}`).then((d) => setStandings(d.standings || [])).catch(() => {})
  }, [category])
  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Classificação (automática)</CardTitle>
          <div className="w-56">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0"><StandingsTable standings={standings} category={category} /></CardContent>
    </Card>
  )
}
