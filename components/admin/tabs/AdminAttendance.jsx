'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClipboardList } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { BLUE, DANGER, GREEN, NAVY } from '@/lib/theme'

// ---------------- ATTENDANCE ----------------
export default function AdminAttendance({ categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [athletes, setAthletes] = useState([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [present, setPresent] = useState({})
  const [freq, setFreq] = useState([])

  useEffect(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`).then((d) => setTeams(d.teams || [])).catch(() => {})
  }, [category])

  const loadTeam = useCallback((tid) => {
    setTeamId(tid)
    api('/admin/athletes?status=approved').then((d) => {
      const list = (d.athletes || []).filter((a) => a.team_id === tid)
      setAthletes(list)
      const init = {}
      list.forEach((a) => (init[a.id] = true))
      setPresent(init)
    })
    api(`/admin/attendance?team_id=${tid}`).then((d) => setFreq(d.attendance || [])).catch(() => {})
  }, [])

  const save = async () => {
    const records = athletes.map((a) => ({ athlete_id: a.id, present: !!present[a.id] }))
    try {
      await api('/admin/attendance', { method: 'POST', body: { team_id: teamId, date, records } })
      toastSuccess('Presença registrada')
      loadTeam(teamId)
    } catch (e) {
      toastError(e.message)
    }
  }

  const uploadSumula = async () => {
    try {
      await api('/admin/sumula', { method: 'POST', body: { team_id: teamId, category, date, filename: 'sumula_digitalizada.jpg' } })
      toastSuccess('Súmula importada (MOCKED - sem OCR real)')
    } catch (e) {
      toastError(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Gestão de Presença</CardTitle>
        <CardDescription>Registro manual (nome a nome) e importação de súmula (MOCKED).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs" htmlFor="admin-attendance-category">Categoria</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setTeamId(''); setAthletes([]) }}>
              <SelectTrigger id="admin-attendance-category"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="admin-attendance-team">Equipe</Label>
            <Select value={teamId} onValueChange={loadTeam}>
              <SelectTrigger id="admin-attendance-team"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs" htmlFor="admin-attendance-date">Data</Label>
            <Input id="admin-attendance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {teamId && (
          <>
            <div className="rounded-lg border divide-y">
              {athletes.map((a) => (
                <label key={a.id} className="flex items-center justify-between p-3 cursor-pointer">
                  <span className="text-sm">{a.name} <span className="text-xs text-slate-600">RG {a.rg}</span></span>
                  <input type="checkbox" className="h-5 w-5" checked={!!present[a.id]} onChange={(e) => setPresent({ ...present, [a.id]: e.target.checked })} />
                </label>
              ))}
              {athletes.length === 0 && <p className="p-3 text-sm text-slate-600">Nenhum atleta aprovado nesta equipe.</p>}
            </div>
            <div className="flex gap-2">
              <Button className="text-white border-0" style={{ background: BLUE }} onClick={save} disabled={athletes.length === 0}>Registrar presença</Button>
              <Button variant="outline" onClick={uploadSumula}><ClipboardList className="h-4 w-4 mr-1" /> Importar súmula (MOCKED)</Button>
            </div>

            {freq.length > 0 && (
              <div>
                <h4 className="font-semibold mt-4 mb-2" style={{ color: NAVY }}>Frequência da equipe</h4>
                <div className="space-y-1">
                  {freq.map((f) => (
                    <div key={f.athlete_id} className="rounded border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{f.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500">{f.present}/{f.total_sessions} ({f.percent}%)</span>
                          <Badge className="border-0 text-white" style={{ background: f.eligible ? GREEN : DANGER }}>
                            {f.eligible ? 'Apto' : 'Inapto'}
                          </Badge>
                        </span>
                      </div>
                      {/* UX (auditoria de leis de UX, Efeito gradiente de meta, Fase 4): marcador no
                          mínimo exigido, mesmo padrão já usado na Frequência do gestor e do atleta. */}
                      <div className="relative mt-2 h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full" style={{ width: `${Math.min(f.percent, 100)}%`, background: f.eligible ? GREEN : DANGER }} />
                        <div className="absolute top-0 h-2 w-0.5 bg-slate-700" style={{ left: `${Math.min(f.min_required, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
