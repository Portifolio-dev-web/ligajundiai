'use client'

import { useEffect, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { BLUE, RED } from '@/lib/theme'

// ---------------- RULES ENGINE ----------------
export default function RulesEngine() {
  const [rules, setRules] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/rules').then((d) => setRules(d.rules)).catch(() => {})
  }, [])

  if (!rules) return <p className="mt-4 text-slate-600">Carregando...</p>

  const setPoint = (k, v) => setRules({ ...rules, points: { ...rules.points, [k]: Number(v) } })

  const tiebreakerOptions = [
    { key: 'points', label: 'Pontos' },
    { key: 'wins', label: 'Vitórias' },
    { key: 'sets_ratio', label: 'Razão de Sets (Set Average)' },
    { key: 'points_ratio', label: 'Razão de Pontos (Point Average)' },
  ]

  const moveTiebreaker = (idx, dir) => {
    const arr = [...rules.tiebreakers]
    const ni = idx + dir
    if (ni < 0 || ni >= arr.length) return
    ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
    setRules({ ...rules, tiebreakers: arr })
  }

  const save = async () => {
    setSaving(true)
    try {
      const d = await api('/rules', { method: 'PUT', body: rules })
      setRules(d.rules)
      toastSuccess('Regulamento salvo! A classificação será recalculada.')
    } catch (e) {
      toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pointFields = [
    ['win_3_0', 'Vitória 3x0'],
    ['win_3_1', 'Vitória 3x1'],
    ['win_3_2', 'Vitória 3x2'],
    ['loss_3_2', 'Derrota 2x3'],
    ['loss_3_1', 'Derrota 1x3'],
    ['loss_3_0', 'Derrota 0x3'],
  ]

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" style={{ color: BLUE }} /> Motor de Regras Configuráveis
        </CardTitle>
        <CardDescription>Defina a pontuação, critérios de desempate e presença mínima. A tabela é recalculada automaticamente.</CardDescription>
      </CardHeader>
      {/* UX (auditoria de leis de UX, Lei de Miller/Carga cognitiva, Fase 3): as 3 seções (6 campos
          de pontuação + 4 critérios reordenáveis + presença mínima) apareciam juntas na mesma
          tela, exigindo entender o sistema de pontuação inteiro antes de mexer em qualquer parte.
          Agora cada seção abre uma de cada vez. */}
      <CardContent>
        <Accordion type="single" collapsible defaultValue="pontuacao" className="w-full">
          <AccordionItem value="pontuacao">
            <AccordionTrigger>Pontuação por resultado</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {pointFields.map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-xs" htmlFor={`rules-point-${k}`}>{label}</Label>
                    <Input id={`rules-point-${k}`} type="number" value={rules.points[k]} onChange={(e) => setPoint(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="desempate">
            <AccordionTrigger>Critérios de desempate (ordem de prioridade)</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {rules.tiebreakers.map((tb, idx) => {
                  const opt = tiebreakerOptions.find((o) => o.key === tb)
                  return (
                    <div key={tb} className="flex items-center gap-2 rounded-lg border p-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold" style={{ background: BLUE }}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm">{opt?.label || tb}</span>
                      <Button size="sm" variant="outline" onClick={() => moveTiebreaker(idx, -1)} disabled={idx === 0}>↑</Button>
                      <Button size="sm" variant="outline" onClick={() => moveTiebreaker(idx, 1)} disabled={idx === rules.tiebreakers.length - 1}>↓</Button>
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="presenca" className="border-b-0">
            <AccordionTrigger>Presença mínima para finais/mata-mata</AccordionTrigger>
            <AccordionContent>
              <div className="max-w-xs">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Presença mínima para finais/mata-mata"
                    type="number"
                    value={rules.min_attendance_percent}
                    onChange={(e) => setRules({ ...rules, min_attendance_percent: Number(e.target.value) })}
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button className="mt-4 text-white border-0" style={{ background: RED }} onClick={save} disabled={saving}>
          Salvar Regulamento
        </Button>
      </CardContent>
    </Card>
  )
}
