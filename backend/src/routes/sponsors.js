import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize, requireCurrentConsent } from '../security/auth.js'
import { cleanText, parse, uuidSchema } from '../security/validation.js'
import { asyncRoute, audit } from '../utils.js'
import {
  createSponsorLogoStagingUpload,
  deleteSponsorStaging,
  putSponsorLogoVariant,
  readSponsorLogoVariant,
  readSponsorStaging,
} from '../services/storage.js'
import { buildSponsorLogoVariants } from '../services/sponsorImage.js'

const tierSchema = z.enum(['apoio', 'bronze', 'prata', 'ouro'])
const VARIANTS = ['flip', 'vticker', 'coverflow']

export const adminSponsorsRouter = Router()
adminSponsorsRouter.use(authenticate, authorize('admin'), requireCurrentConsent)

adminSponsorsRouter.get('/', asyncRoute(async (_req, res) => {
  const result = await query(
    `SELECT id, name, logo_url, website, tier, active FROM sponsors
     WHERE deleted_at IS NULL ORDER BY name`,
  )
  res.json({ sponsors: result.rows })
}))

adminSponsorsRouter.post('/', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(2).max(120),
    website: z.string().trim().max(500).optional().default(''),
    tier: tierSchema.optional().default('apoio'),
  }).strict(), req.body)

  const sponsor = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO sponsors (name, website, tier)
       VALUES ($1, $2, $3) RETURNING id, name, logo_url, website, tier, active`,
      [cleanText(input.name, 120), cleanText(input.website, 500), input.tier],
    )
    const row = result.rows[0]
    await audit(client, req.user, 'sponsor.create', 'sponsor', row.id, { name: row.name })
    return row
  })
  res.status(201).json({ sponsor })
}))

adminSponsorsRouter.put('/:sponsorId', asyncRoute(async (req, res) => {
  const params = parse(z.object({ sponsorId: uuidSchema }).strict(), req.params)
  const input = parse(z.object({
    name: z.string().trim().min(2).max(120).optional(),
    website: z.string().trim().max(500).optional(),
    tier: tierSchema.optional(),
    active: z.boolean().optional(),
  }).strict(), req.body)

  const sponsor = await transaction(async (client) => {
    const current = await client.query(
      'SELECT * FROM sponsors WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [params.sponsorId],
    )
    const existing = current.rows[0]
    if (!existing) throw notFound('Patrocinador não encontrado')

    const result = await client.query(
      `UPDATE sponsors SET name = $2, website = $3, tier = $4, active = $5, updated_at = now()
       WHERE id = $1 RETURNING id, name, logo_url, website, tier, active`,
      [
        existing.id,
        input.name !== undefined ? cleanText(input.name, 120) : existing.name,
        input.website !== undefined ? cleanText(input.website, 500) : existing.website,
        input.tier ?? existing.tier,
        input.active ?? existing.active,
      ],
    )
    await audit(client, req.user, 'sponsor.update', 'sponsor', existing.id, { name: result.rows[0].name })
    return result.rows[0]
  })
  res.json({ sponsor })
}))

adminSponsorsRouter.delete('/:sponsorId', asyncRoute(async (req, res) => {
  const params = parse(z.object({ sponsorId: uuidSchema }).strict(), req.params)
  await transaction(async (client) => {
    const current = await client.query(
      'SELECT id, name FROM sponsors WHERE id = $1 AND deleted_at IS NULL',
      [params.sponsorId],
    )
    const existing = current.rows[0]
    if (!existing) throw notFound('Patrocinador não encontrado')
    await client.query('UPDATE sponsors SET deleted_at = now() WHERE id = $1', [existing.id])
    await audit(client, req.user, 'sponsor.delete', 'sponsor', existing.id, { name: existing.name })
  })
  res.json({ ok: true })
}))

// Passo 1 de 2 do envio do logo: o navegador manda o arquivo bruto direto pro armazenamento (POST
// pré-assinado) — mesmo padrão já usado no envio de foto de atleta (ver athletes.js), o servidor
// Node nunca recebe o arquivo inteiro nesta etapa.
adminSponsorsRouter.post('/:sponsorId/logo/upload-url', asyncRoute(async (req, res) => {
  const params = parse(z.object({ sponsorId: uuidSchema }).strict(), req.params)
  const input = parse(z.object({
    content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }).strict(), req.body)

  const existing = await query('SELECT id FROM sponsors WHERE id = $1 AND deleted_at IS NULL', [params.sponsorId])
  if (!existing.rowCount) throw notFound('Patrocinador não encontrado')

  const upload = await createSponsorLogoStagingUpload(req.user.id, input.content_type)
  if (!upload) throw new AppError(400, 'INVALID_CONTENT_TYPE', 'Formato de imagem não suportado')
  res.status(201).json(upload)
}))

// Passo 2 de 2: com o arquivo bruto já no armazenamento, o servidor baixa, recorta nos 3 formatos
// e salva os resultados — só então o patrocinador passa a ter um logo_url válido.
adminSponsorsRouter.post('/:sponsorId/logo/process', asyncRoute(async (req, res) => {
  const params = parse(z.object({ sponsorId: uuidSchema }).strict(), req.params)
  const input = parse(z.object({ staging_key: z.string().min(1).max(300) }).strict(), req.body)

  // Mesma checagem de posse usada em athletes.js para a chave de biometria: a key pré-assinada
  // devolvida no passo 1 começa com o id de quem pediu, então ninguém processa o rascunho de outro
  // admin só adivinhando/copiando uma key.
  if (!input.staging_key.startsWith(`sponsor-staging/${req.user.id}/`)) {
    throw new AppError(400, 'INVALID_STAGING_KEY', 'A chave enviada não pertence a este usuário')
  }

  const existing = await query('SELECT id, name FROM sponsors WHERE id = $1 AND deleted_at IS NULL', [params.sponsorId])
  const sponsor = existing.rows[0]
  if (!sponsor) throw notFound('Patrocinador não encontrado')

  let rawBuffer
  try {
    rawBuffer = await readSponsorStaging(input.staging_key)
  } catch {
    throw new AppError(400, 'UPLOAD_NOT_FOUND', 'O envio da imagem não foi concluído ou expirou. Envie novamente.')
  }

  let variants
  try {
    variants = await buildSponsorLogoVariants(rawBuffer)
  } catch {
    throw new AppError(400, 'INVALID_IMAGE', 'Não foi possível processar essa imagem. Tente outro arquivo.')
  }

  for (const [variant, buffer] of Object.entries(variants)) {
    await putSponsorLogoVariant(sponsor.id, variant, buffer)
  }
  await deleteSponsorStaging(input.staging_key)

  const logoUrl = `/api/sponsor-logos/flip/${sponsor.id}`
  await transaction(async (client) => {
    await client.query('UPDATE sponsors SET logo_url = $2, updated_at = now() WHERE id = $1', [sponsor.id, logoUrl])
    await audit(client, req.user, 'sponsor.logo_update', 'sponsor', sponsor.id, { name: sponsor.name })
  })
  res.json({ logo_url: logoUrl })
}))

// Rota pública (sem authenticate): serve as 3 variantes já processadas. Fica sob /api pra herdar o
// mesmo domínio do site — next/image e o navegador nunca falam direto com o S3, então
// next.config.js não precisa liberar nenhum domínio externo de imagem (ver storage.js).
export const sponsorLogosRouter = Router()
sponsorLogosRouter.get('/:variant/:sponsorId', asyncRoute(async (req, res) => {
  const params = parse(z.object({
    variant: z.enum(VARIANTS),
    sponsorId: uuidSchema,
  }).strict(), req.params)

  const object = await readSponsorLogoVariant(params.sponsorId, params.variant)
  if (!object || !object.Body) throw notFound('Logo não encontrado')

  // Sobrescreve o "Cache-Control: no-store" que app.js aplica a toda a família /api — essa é a
  // única rota ali que serve conteúdo público e estável, então cache de verdade é o comportamento
  // certo, não um descuido. max-age curto porque o admin pode trocar o logo a qualquer momento;
  // ETag deixa o navegador revalidar sem baixar de novo quando não mudou.
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate')
  if (object.ETag) res.setHeader('ETag', object.ETag)
  object.Body.pipe(res)
}))
