'use client'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Info } from 'lucide-react'
import { AMBER, BLUE, DANGER, GREEN, ORANGE, RED, SLATE } from '@/lib/theme'

export function categoryAbbrev(category) {
  if (!category) return '#'
  const letters = category
    .split(/[\s-]+/)
    .filter((word) => /^[A-Za-zÀ-ÿ]/.test(word))
    .map((word) => word[0].toUpperCase())
    .join('')
  return letters || '#'
}

export function formatAverage(value) {
  const n = Number(value) || 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const STANDINGS_LEGEND = [
  { abbr: 'PTS', label: 'Pontos' },
  { abbr: 'J', label: 'Jogos' },
  { abbr: 'V', label: 'Vitórias' },
  { abbr: 'D', label: 'Derrotas' },
  { abbr: 'SP', label: 'Sets pró' },
  { abbr: 'SC', label: 'Sets contra' },
  { abbr: 'S.A', label: 'Sets average (SP ÷ SC)' },
  { abbr: 'PP', label: 'Pontos pró' },
  { abbr: 'PC', label: 'Pontos contra' },
  { abbr: 'PA', label: 'Pontos average (PP ÷ PC)' },
]

export function StandingsLegend({ category, abbr }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ver legenda das siglas da tabela"
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-600"
        >
          <Info className="h-3.5 w-3.5" /> Legenda
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-xs text-slate-600">
        <p className="mb-2 font-semibold text-slate-700">
          {abbr} — {category}
        </p>
        <ul className="space-y-1">
          {STANDINGS_LEGEND.map((item) => (
            <li key={item.abbr} className="flex gap-2">
              <span className="w-10 shrink-0 font-bold" style={{ color: BLUE }}>
                {item.abbr}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function StandingsTable({ standings, category }) {
  const abbr = categoryAbbrev(category)
  return (
    <div>
      <div className="flex items-center justify-end px-3 pt-3">
        <StandingsLegend category={category} abbr={abbr} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{abbr}</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead className="text-center">Pts</TableHead>
            <TableHead className="text-center">J</TableHead>
            <TableHead className="text-center">V</TableHead>
            <TableHead className="text-center">D</TableHead>
            <TableHead className="text-center hidden sm:table-cell">SP</TableHead>
            <TableHead className="text-center hidden sm:table-cell">SC</TableHead>
            <TableHead className="text-center hidden md:table-cell">S.A</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PP</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PC</TableHead>
            <TableHead className="text-center hidden lg:table-cell">PA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((s) => (
            <TableRow key={s.team_id}>
              <TableCell>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: s.position <= 4 ? RED : '#94a3b8' }}
                >
                  {s.position}
                </span>
              </TableCell>
              <TableCell className="font-semibold">{s.name}</TableCell>
              <TableCell className="text-center font-bold" style={{ color: BLUE }}>
                {s.points}
              </TableCell>
              <TableCell className="text-center">{s.played}</TableCell>
              <TableCell className="text-center">{s.wins}</TableCell>
              <TableCell className="text-center">{s.losses}</TableCell>
              <TableCell className="text-center hidden sm:table-cell text-slate-500">{s.sets_won}</TableCell>
              <TableCell className="text-center hidden sm:table-cell text-slate-500">{s.sets_lost}</TableCell>
              <TableCell className="text-center hidden md:table-cell text-slate-500">{formatAverage(s.sets_ratio)}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{s.rally_for}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{s.rally_against}</TableCell>
              <TableCell className="text-center hidden lg:table-cell text-slate-500">{formatAverage(s.points_ratio)}</TableCell>
            </TableRow>
          ))}
          {standings.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-slate-600 py-8">
                Nenhuma equipe aprovada nesta categoria ainda.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Pendente', bg: AMBER },
    awaiting_manager: { label: 'Aguardando gestor', bg: AMBER },
    awaiting_admin: { label: 'Aguardando administrador', bg: ORANGE },
    approved: { label: 'Aprovado', bg: GREEN },
    rejected: { label: 'Recusado', bg: DANGER },
    proposed: { label: 'Aguardando aceite', bg: AMBER },
    confirmed: { label: 'Confirmado', bg: GREEN },
    scheduled: { label: 'Agendado', bg: GREEN },
    cancelled: { label: 'Cancelado', bg: SLATE },
    finished: { label: 'Finalizado', bg: SLATE },
  }
  const s = map[status] || map.pending
  return (
    <Badge className="text-white border-0" style={{ background: s.bg }}>
      {s.label}
    </Badge>
  )
}
