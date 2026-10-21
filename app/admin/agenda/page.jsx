'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CalendarDays, LoaderCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { CATEGORY_FALLBACK } from '@/lib/lvjApi'

const today = new Date()
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function AdminAgendaPage() {
  const [date, setDate] = useState()
  const [time, setTime] = useState('19:00')
  const [venue, setVenue] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    if (!date || !category) {
      setError('Selecione a data e a categoria.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const availableAt = new Date(`${localDate(date)}T${time}:00`).toISOString()
      await api('/admin/game-dates', {
        method: 'POST',
        body: { available_at: availableAt, venue: venue.trim(), category },
      })
      setMessage('Data disponível criada com sucesso.')
      setVenue('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    // ACESSIBILIDADE (varredura, item A2): id="main-content" é o alvo do link "Pular para o
    // conteúdo" em app/layout.js — faltava aqui, então o link não levava a lugar nenhum nesta tela.
    <main id="main-content" className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-10">
      <Button asChild variant="ghost"><Link href="/admin/aprovacoes"><ArrowLeft className="h-4 w-4" /> Aprovações</Link></Button>
      <Card>
        <CardHeader><CardTitle>Criar data disponível</CardTitle><CardDescription>Defina uma sugestão de data e local para uma categoria. As equipes poderão aceitá-la ao ser proposta para um jogo.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            {error && <Alert variant="destructive"><AlertTitle>Não foi possível salvar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {message && <Alert><AlertTitle>Concluído</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label>Data do jogo</Label>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarDays className="h-4 w-4" />{date ? date.toLocaleDateString('pt-BR') : 'Selecione uma data'}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date(today.getFullYear(), today.getMonth(), today.getDate())} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="game-time">Horário</Label><Input id="game-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></div>
              <div className="space-y-2"><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent>{CATEGORY_FALLBACK.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="game-venue">Local (opcional)</Label><Input id="game-venue" value={venue} maxLength={200} onChange={(event) => setVenue(event.target.value)} placeholder="Ginásio" /></div>
            <Button type="submit" disabled={saving || !date || !category}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Criar data disponível</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
