'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { StatusBadge } from '@/components/standings'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { BLUE, RED } from '@/lib/theme'

// ---------------- MATCHES ----------------
export default function AdminMatches({ categories }) {
  const [category, setCategory] = useState(categories[0])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
  const [resultMatch, setResultMatch] = useState(null)
  const [sets, setSets] = useState([{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }])

  const load = useCallback(() => {
    api(`/admin/teams-approved?category=${encodeURIComponent(category)}`).then((d) => setTeams(d.teams || [])).catch(() => {})
    api(`/matches?category=${encodeURIComponent(category)}`).then((d) => setMatches(d.matches || [])).catch(() => {})
  }, [category])
  useEffect(load, [load])

  const create = async () => {
    if (!form.home_team_id || !form.away_team_id || form.home_team_id === form.away_team_id) {
      toastError('Selecione duas equipes diferentes')
      return
    }
    try {
      await api('/admin/matches', { method: 'POST', body: form })
      toastSuccess('Jogo agendado')
      setForm({ home_team_id: '', away_team_id: '', scheduled_at: '', venue: '', round: '' })
      load()
    } catch (e) {
      toastError(e.message)
    }
  }

  const saveResult = async () => {
    const clean = sets.filter((s) => s.home !== '' && s.away !== '')
    try {
      await api(`/admin/matches/${resultMatch.id}/result`, { method: 'PUT', body: { sets: clean.map((s) => ({ home: Number(s.home), away: Number(s.away) })) } })
      toastSuccess('Resultado salvo! Classificação atualizada.')
      setResultMatch(null)
      load()
    } catch (e) {
      toastError(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Agenda & Resultados</CardTitle>
        <CardDescription>Agende jogos e insira placares (sets). A classificação é gerada automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="w-full md:w-72">
          <Label className="text-xs">Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border p-4 grid gap-3 md:grid-cols-5 items-end bg-slate-50">
          <div className="md:col-span-1">
            <Label className="text-xs">Mandante</Label>
            <Select value={form.home_team_id} onValueChange={(v) => setForm({ ...form, home_team_id: v })}>
              <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Visitante</Label>
            <Select value={form.away_team_id} onValueChange={(v) => setForm({ ...form, away_team_id: v })}>
              <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data/Hora</Label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Local / Rodada</Label>
            <Input placeholder="Ginásio / Rodada 1" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <Button className="text-white border-0" style={{ background: BLUE }} onClick={create}>
            <Plus className="h-4 w-4 mr-1" /> Agendar
          </Button>
        </div>

        <div className="space-y-2">
          {matches.map((m) => {
            const hs = (m.sets || []).filter((s) => s.home > s.away).length
            const as = (m.sets || []).filter((s) => s.away > s.home).length
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <div className="font-semibold">
                    {m.home_name} <span className="text-slate-600">x</span> {m.away_name}
                    {m.status === 'finished' && <span className="ml-2 font-bold" style={{ color: BLUE }}>({hs}-{as})</span>}
                  </div>
                  <div className="text-xs text-slate-500">{new Date(m.scheduled_at).toLocaleString('pt-BR')} {m.venue ? `• ${m.venue}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  <Button size="sm" variant="outline" disabled={!['confirmed', 'scheduled', 'finished'].includes(m.status)} onClick={() => { setResultMatch(m); setSets([{ home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }, { home: '', away: '' }].map((s, i) => (m.sets && m.sets[i]) ? { home: String(m.sets[i].home), away: String(m.sets[i].away) } : s)) }}>
                    Placar
                  </Button>
                </div>
              </div>
            )
          })}
          {matches.length === 0 && <p className="text-sm text-slate-600">Nenhum jogo nesta categoria.</p>}
        </div>
      </CardContent>

      <Dialog open={!!resultMatch} onOpenChange={(o) => !o && setResultMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placar por set</DialogTitle>
            <DialogDescription>{resultMatch?.home_name} x {resultMatch?.away_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-sm text-slate-500">Set {i + 1}</span>
                <Input type="number" value={s.home} onChange={(e) => { const n = [...sets]; n[i] = { ...n[i], home: e.target.value }; setSets(n) }} placeholder="0" />
                <span>x</span>
                <Input type="number" value={s.away} onChange={(e) => { const n = [...sets]; n[i] = { ...n[i], away: e.target.value }; setSets(n) }} placeholder="0" />
              </div>
            ))}
          </div>
          <Button className="text-white border-0" style={{ background: RED }} onClick={saveResult}>Salvar resultado</Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
