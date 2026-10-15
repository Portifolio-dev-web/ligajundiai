'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, LoaderCircle, ShieldCheck, Users } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { CATEGORY_FALLBACK } from '@/lib/lvjApi'

export default function GestorDashboardPage() {
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await api('/teams/mine')
      setTeam(result.team)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createTeam = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/teams', { method: 'POST', body: { name: name.trim(), category } })
      setTeam(result.team)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-10">
      <header><p className="text-sm font-medium text-muted-foreground">Área do gestor</p><h1 className="text-3xl font-bold">Painel da equipe</h1></header>
      {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {loading
        ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando equipe…</div>
        : team
          ? <Card>
            <CardHeader><CardTitle>{team.name}</CardTitle><CardDescription>{team.category}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {team.status === 'pending' && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Pendente de aprovação pelo Admin</AlertTitle><AlertDescription>A equipe ficará indisponível para cadastro de atletas até a aprovação do administrador.</AlertDescription></Alert>}
              {team.status === 'rejected' && <Alert variant="destructive"><AlertTitle>Equipe não aprovada</AlertTitle><AlertDescription>{team.justification || 'Entre em contato com o administrador.'}</AlertDescription></Alert>}
              {team.status === 'approved' && <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Equipe aprovada</AlertTitle><AlertDescription>Você já pode cadastrar e acompanhar atletas.</AlertDescription></Alert>}
              <div className="flex flex-wrap gap-3">
                <Button asChild disabled={team.status !== 'approved'}><Link href="/cadastro-atleta"><Users className="h-4 w-4" /> Cadastrar atleta</Link></Button>
                <Button asChild variant="outline"><Link href="/gestor/aprovar-atletas">Aprovar atletas <ArrowRight className="h-4 w-4" /></Link></Button>
                <Button asChild variant="outline"><Link href="/gestor/jogos">Agenda de jogos</Link></Button>
              </div>
            </CardContent>
          </Card>
          : <Card>
            <CardHeader><CardTitle>Cadastro da equipe</CardTitle><CardDescription>Cadastre o nome e a categoria para enviar a solicitação de aprovação.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={createTeam} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="team-name">Nome da equipe</Label><Input id="team-name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div>
                <div className="space-y-2"><Label>Categoria</Label><Select value={category} onValueChange={setCategory} required><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent>{CATEGORY_FALLBACK.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                <div className="sm:col-span-2"><Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Pendente de aprovação pelo Admin</AlertTitle><AlertDescription>A equipe será analisada antes de ficar disponível para cadastro de atletas.</AlertDescription></Alert></div>
                <Button className="sm:col-span-2" type="submit" disabled={saving || !category}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Enviar equipe</Button>
              </form>
            </CardContent>
          </Card>}
    </main>
  )
}