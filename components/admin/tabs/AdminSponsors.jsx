'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoaderCircle, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react'
import { toastSuccess, toastError } from '@/lib/toast'
import { api } from '@/lib/lvjApi'
import { sponsorImageVariant } from '@/lib/sponsorImage'
import { BLUE, NAVY } from '@/lib/theme'

const TIER_LABEL = { apoio: 'Apoio', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro' }
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_LOGO_SIZE = 5 * 1024 * 1024

const emptyForm = { name: '', website: '', tier: 'apoio' }

export default function AdminSponsors() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    api('/admin/sponsors').then((d) => setSponsors(d.sponsors || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  // ---- diálogo novo/editar ----
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setPreviewUrl(null)
    setUploadError('')
    setDialogOpen(true)
  }
  const openEdit = (sponsor) => {
    setEditing(sponsor)
    setForm({ name: sponsor.name, website: sponsor.website || '', tier: sponsor.tier })
    setFile(null)
    setPreviewUrl(sponsor.logo_url ? sponsorImageVariant(sponsor.logo_url, 'flip') : null)
    setUploadError('')
    setDialogOpen(true)
  }

  const handleFile = (f) => {
    if (!f) return
    if (!ALLOWED_TYPES.has(f.type)) { setUploadError('Formato não aceito. Use JPG, PNG ou WebP.'); return }
    if (f.size > MAX_LOGO_SIZE) { setUploadError('Arquivo maior que 5MB.'); return }
    setUploadError('')
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  // Envia o logo em 2 passos: (1) pede uma URL pré-assinada e manda o arquivo bruto direto pro
  // armazenamento — o servidor Node nunca recebe o arquivo inteiro nesta etapa, mesmo padrão já
  // usado no envio de foto de atleta (ver components/CameraCapture.jsx); (2) pede pro servidor
  // processar o rascunho, que recorta nos 3 formatos e só então vira o logo_url do patrocinador.
  const uploadLogo = async (sponsorId) => {
    const { uploadUrl, uploadFields, key } = await api(`/admin/sponsors/${sponsorId}/logo/upload-url`, {
      method: 'POST',
      body: { content_type: file.type },
    })
    const body = new FormData()
    for (const [name, value] of Object.entries(uploadFields)) body.append(name, value)
    body.append('file', file, file.name)
    const response = await fetch(uploadUrl, { method: 'POST', body })
    if (!response.ok) throw new Error(`Falha ao enviar o logo para o armazenamento (HTTP ${response.status}).`)
    const { logo_url } = await api(`/admin/sponsors/${sponsorId}/logo/process`, {
      method: 'POST',
      body: { staging_key: key },
    })
    return logo_url
  }

  const save = async () => {
    if (!form.name.trim()) { toastError('Informe o nome do patrocinador'); return }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), website: form.website.trim(), tier: form.tier }
      let sponsor
      if (editing) {
        const { sponsor: updated } = await api(`/admin/sponsors/${editing.id}`, { method: 'PUT', body })
        sponsor = updated
      } else {
        const { sponsor: created } = await api('/admin/sponsors', { method: 'POST', body })
        sponsor = created
      }
      if (file) {
        try {
          sponsor = { ...sponsor, logo_url: await uploadLogo(sponsor.id) }
        } catch (e) {
          // UX: o cadastro/edição já foi salvo — um upload que falha não deve esconder isso do
          // admin nem obrigar a refazer o resto do formulário, só o logo fica pendente de reenvio.
          toastError(`Patrocinador salvo, mas o envio do logo falhou: ${e.message}`)
          setDialogOpen(false)
          load()
          return
        }
      }
      setSponsors((prev) => {
        const exists = prev.some((s) => s.id === sponsor.id)
        return exists ? prev.map((s) => (s.id === sponsor.id ? sponsor : s)) : [...prev, sponsor].sort((a, b) => a.name.localeCompare(b.name))
      })
      toastSuccess(editing ? 'Patrocinador atualizado' : 'Patrocinador criado')
      setDialogOpen(false)
    } catch (e) {
      toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ---- remover ----
  const [removeTarget, setRemoveTarget] = useState(null)
  const removeSponsor = async () => {
    try {
      await api(`/admin/sponsors/${removeTarget.id}`, { method: 'DELETE' })
      setSponsors((prev) => prev.filter((s) => s.id !== removeTarget.id))
      toastSuccess('Patrocinador removido')
    } catch (e) {
      toastError(e.message)
    } finally {
      setRemoveTarget(null)
    }
  }

  // ---- ativar/desativar (só a desativação pede confirmação — mesmo critério de AdminCategories) ----
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const setActive = async (sponsor, active) => {
    try {
      const { sponsor: updated } = await api(`/admin/sponsors/${sponsor.id}`, { method: 'PUT', body: { active } })
      setSponsors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      toastSuccess(active ? 'Patrocinador ativado' : 'Patrocinador desativado')
    } catch (e) {
      toastError(e.message)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Patrocinadores</CardTitle>
          <CardDescription>
            Logo, site e status de cada patrocinador. Ao enviar uma imagem, o servidor recorta automaticamente
            nos 3 formatos usados pelo site (faixa do topo, barra lateral e rodapé).
          </CardDescription>
        </div>
        <Button onClick={openNew} className="text-white border-0" style={{ background: BLUE }}>
          <Plus className="h-4 w-4 mr-1" /> Novo patrocinador
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="w-24">Cota</TableHead>
                <TableHead className="w-20 text-center">Ativo</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsors.map((s) => (
                <TableRow key={s.id} className={!s.active ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="relative h-9 w-14 overflow-hidden rounded-md" style={{ background: NAVY }}>
                      {s.logo_url && (
                        <Image src={sponsorImageVariant(s.logo_url, 'flip')} alt="" fill sizes="56px" className="object-contain" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {s.website ? (
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: BLUE }}>
                        {s.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                      {TIER_LABEL[s.tier] || s.tier}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={s.active}
                      onCheckedChange={(checked) => (checked ? setActive(s, true) : setDeactivateTarget(s))}
                      aria-label={`${s.active ? 'Desativar' : 'Ativar'} ${s.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setRemoveTarget(s)} title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sponsors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-600 py-8">Nenhum patrocinador cadastrado ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar patrocinador' : 'Novo patrocinador'}</DialogTitle>
            <DialogDescription>Preencha os dados e envie o logo. O recorte nos 3 formatos acontece automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500">Nome do patrocinador</Label>
              <Input placeholder="Ex: Cereser" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Site (opcional)</Label>
                <Input placeholder="https://..." value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Cota</Label>
                <Select value={form.tier} onValueChange={(tier) => setForm((f) => ({ ...f, tier }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIER_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Logo</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
              >
                <UploadCloud className="mx-auto h-5 w-5 text-slate-400" />
                <p className="mt-1 text-sm font-medium">Arraste uma imagem ou clique pra escolher</p>
                <p className="text-xs text-slate-500">JPG, PNG ou WebP · até 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
              {previewUrl && (
                <div className="mt-2 flex items-center gap-3 rounded-lg border bg-slate-50 p-2">
                  <div className="relative h-14 w-14 flex-none overflow-hidden rounded-md" style={{ background: NAVY }}>
                    <Image src={previewUrl} alt="" fill sizes="56px" className="object-contain" unoptimized={previewUrl.startsWith('blob:')} />
                  </div>
                  <span className="text-xs text-slate-500">{file ? file.name : 'Logo atual'}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="text-white border-0" style={{ background: BLUE }}>
              {saving ? <LoaderCircle className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar patrocinador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover patrocinador</AlertDialogTitle>
            <AlertDialogDescription>
              Remover &ldquo;{removeTarget?.name}&rdquo;? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={removeSponsor}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar patrocinador</AlertDialogTitle>
            <AlertDialogDescription>
              Desativar &ldquo;{deactivateTarget?.name}&rdquo;? Ele some do site até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setActive(deactivateTarget, false); setDeactivateTarget(null) }}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
