'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { BLUE } from '@/lib/theme'

export default function AdminCategories({ onCategoriesChanged }) {
  const [categories, setCategories] = useState([])
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [newForm, setNewForm] = useState({ name: '', abbreviation: '', sort_order: '' })
  const [creating, setCreating] = useState(false)
  // ACESSIBILIDADE (varredura, item A6): window.confirm nativo era a única ação irreversível do
  // app fora do padrão de diálogo real (AlertDialog já existia em components/ui, só não era usado
  // em lugar nenhum) — inconsistente, sem foco gerenciado nem leitura por leitor de tela como os
  // outros diálogos da aplicação.
  const [removeTarget, setRemoveTarget] = useState(null)
  // UX (auditoria de leis de UX, Lei de Murphy): desativar disparava direto no clique do switch,
  // podendo ocultar uma categoria por acidente — só a desativação (não a ativação) pede confirmação.
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const load = useCallback(() => {
    api('/admin/categories').then((d) => {
      const list = d.categories || []
      setCategories(list)
      setDrafts(Object.fromEntries(list.map((c) => [c.id, { name: c.name, abbreviation: c.abbreviation, sort_order: String(c.sort_order) }])))
    }).catch(() => {})
  }, [])
  useEffect(load, [load])

  const setDraft = (id, field, value) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const isDirty = (cat) => {
    const d = drafts[cat.id]
    if (!d) return false
    return d.name !== cat.name || d.abbreviation !== cat.abbreviation || Number(d.sort_order) !== cat.sort_order
  }

  const saveCategory = async (cat) => {
    const d = drafts[cat.id]
    setSavingId(cat.id)
    try {
      const { category } = await api(`/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: { name: d.name.trim(), abbreviation: d.abbreviation.trim(), sort_order: Number(d.sort_order) || 0 },
      })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      toastSuccess('Categoria atualizada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  const toggleActive = async (cat) => {
    try {
      const { category } = await api(`/admin/categories/${cat.id}`, { method: 'PUT', body: { active: !cat.active } })
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
      toastSuccess(category.active ? 'Categoria ativada' : 'Categoria desativada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    }
  }

  const removeCategory = async (cat) => {
    try {
      await api(`/admin/categories/${cat.id}`, { method: 'DELETE' })
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      toastSuccess('Categoria removida')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    } finally {
      setRemoveTarget(null)
    }
  }

  const createCategory = async () => {
    if (!newForm.name.trim() || !newForm.abbreviation.trim()) {
      toastError('Informe nome e sigla da categoria')
      return
    }
    setCreating(true)
    try {
      const { category } = await api('/admin/categories', {
        method: 'POST',
        body: {
          name: newForm.name.trim(),
          abbreviation: newForm.abbreviation.trim(),
          sort_order: Number(newForm.sort_order) || (categories.length + 1),
        },
      })
      setCategories((prev) => [...prev, category].sort((a, b) => a.sort_order - b.sort_order))
      setDrafts((prev) => ({ ...prev, [category.id]: { name: category.name, abbreviation: category.abbreviation, sort_order: String(category.sort_order) } }))
      setNewForm({ name: '', abbreviation: '', sort_order: '' })
      toastSuccess('Categoria criada')
      onCategoriesChanged?.()
    } catch (e) {
      toastError(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Categorias</CardTitle>
        <CardDescription>
          Gerencie as categorias do campeonato (nome, sigla e ordem de exibição). Renomear ou remover uma categoria
          com equipes ou jogos cadastrados é bloqueado — nesse caso, desative-a e crie uma nova.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_auto] gap-2 items-end bg-slate-50">
          <div>
            <Label className="text-xs text-slate-500">Nova categoria</Label>
            <Input placeholder="Ex: Sub-21 Masculino" value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Sigla</Label>
            <Input placeholder="Ex: S21" maxLength={6} value={newForm.abbreviation} onChange={(e) => setNewForm((f) => ({ ...f, abbreviation: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Ordem</Label>
            <Input type="number" placeholder="Auto" value={newForm.sort_order} onChange={(e) => setNewForm((f) => ({ ...f, sort_order: e.target.value }))} />
          </div>
          <Button onClick={createCategory} disabled={creating} className="text-white border-0" style={{ background: BLUE }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-28">Sigla</TableHead>
              <TableHead className="w-24 text-center">Ordem</TableHead>
              <TableHead className="w-20 text-center">Ativa</TableHead>
              <TableHead className="w-28 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => {
              const d = drafts[cat.id] || { name: cat.name, abbreviation: cat.abbreviation, sort_order: String(cat.sort_order) }
              const dirty = isDirty(cat)
              return (
                <TableRow key={cat.id} className={!cat.active ? 'opacity-50' : ''}>
                  <TableCell>
                    <Input value={d.name} onChange={(e) => setDraft(cat.id, 'name', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <Input maxLength={6} value={d.abbreviation} onChange={(e) => setDraft(cat.id, 'abbreviation', e.target.value.toUpperCase())} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" className="text-center" value={d.sort_order} onChange={(e) => setDraft(cat.id, 'sort_order', e.target.value)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={cat.active}
                      onCheckedChange={(checked) => (checked ? toggleActive(cat) : setDeactivateTarget(cat))}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" disabled={!dirty || savingId === cat.id} onClick={() => saveCategory(cat)} title="Salvar alterações">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setRemoveTarget(cat)} title="Remover categoria">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-600 py-8">Nenhuma categoria cadastrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a categoria &ldquo;{removeTarget?.name}&rdquo;? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeCategory(removeTarget)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Desativar &ldquo;{deactivateTarget?.name}&rdquo;? Ela deixa de aparecer para gestores e atletas até ser reativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { toggleActive(deactivateTarget); setDeactivateTarget(null) }}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
