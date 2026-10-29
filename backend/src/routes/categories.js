import { Router } from 'express'
import { z } from 'zod'
import { transaction } from '../db/pool.js'
import { AppError, notFound } from '../errors.js'
import { authenticate, authorize } from '../security/auth.js'
import { cleanText, parse, uuidSchema } from '../security/validation.js'
import { asyncRoute, audit } from '../utils.js'
import { listCategories } from '../services/categories.js'

export const adminCategoriesRouter = Router()
adminCategoriesRouter.use(authenticate, authorize('admin'))

async function categoryUsage(client, name) {
  // SEGURANÇA: antes só contava teams/matches; game_dates e registration_periods também
  // guardam category como texto livre (sem FK) e eram ignorados, permitindo renomear/excluir
  // uma categoria com horários/janelas de inscrição agendados, apesar da mensagem de erro
  // afirmar proteção completa.
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM teams WHERE category = $1 AND deleted_at IS NULL) AS teams,
       (SELECT count(*)::int FROM matches WHERE category = $1 AND deleted_at IS NULL) AS matches,
       (SELECT count(*)::int FROM game_dates WHERE category = $1 AND deleted_at IS NULL) AS game_dates,
       (SELECT count(*)::int FROM registration_periods WHERE category = $1) AS registration_periods`,
    [name],
  )
  return result.rows[0]
}

function categoryInUse(usage) {
  return usage.teams > 0 || usage.matches > 0 || usage.game_dates > 0 || usage.registration_periods > 0
}

adminCategoriesRouter.get('/', asyncRoute(async (_req, res) => {
  res.json({ categories: await listCategories({ includeInactive: true }) })
}))

adminCategoriesRouter.post('/', asyncRoute(async (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(2).max(80),
    abbreviation: z.string().trim().min(1).max(6),
    sort_order: z.number().int().min(0).max(9999).optional().default(0),
  }).strict(), req.body)
  const category = await transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO categories (name, abbreviation, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [cleanText(input.name, 80), cleanText(input.abbreviation, 6).toUpperCase(), input.sort_order],
    )
    const row = result.rows[0]
    await audit(client, req.user, 'category.create', 'category', row.id, { name: row.name })
    return row
  })
  res.status(201).json({ category })
}))

adminCategoriesRouter.put('/:categoryId', asyncRoute(async (req, res) => {
  const params = parse(z.object({ categoryId: uuidSchema }).strict(), req.params)
  const input = parse(z.object({
    name: z.string().trim().min(2).max(80).optional(),
    abbreviation: z.string().trim().min(1).max(6).optional(),
    sort_order: z.number().int().min(0).max(9999).optional(),
    active: z.boolean().optional(),
  }).strict(), req.body)

  const category = await transaction(async (client) => {
    const current = await client.query('SELECT * FROM categories WHERE id = $1 FOR UPDATE', [params.categoryId])
    const existing = current.rows[0]
    if (!existing) throw notFound('Categoria não encontrada')

    const nextName = input.name !== undefined ? cleanText(input.name, 80) : existing.name
    if (nextName !== existing.name) {
      const usage = await categoryUsage(client, existing.name)
      if (categoryInUse(usage)) {
        throw new AppError(
          409,
          'CATEGORY_IN_USE',
          'Não é possível renomear: já existem equipes, jogos, horários ou janelas de inscrição cadastrados nesta categoria. Desative-a e crie uma nova em vez disso.',
        )
      }
    }
    const nextAbbreviation = input.abbreviation !== undefined
      ? cleanText(input.abbreviation, 6).toUpperCase()
      : existing.abbreviation

    const result = await client.query(
      `UPDATE categories SET name = $2, abbreviation = $3, sort_order = $4, active = $5, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        existing.id,
        nextName,
        nextAbbreviation,
        input.sort_order ?? existing.sort_order,
        input.active ?? existing.active,
      ],
    )
    await audit(client, req.user, 'category.update', 'category', existing.id, { from: existing.name, to: nextName })
    return result.rows[0]
  })
  res.json({ category })
}))

adminCategoriesRouter.delete('/:categoryId', asyncRoute(async (req, res) => {
  const params = parse(z.object({ categoryId: uuidSchema }).strict(), req.params)
  await transaction(async (client) => {
    const current = await client.query('SELECT * FROM categories WHERE id = $1', [params.categoryId])
    const existing = current.rows[0]
    if (!existing) throw notFound('Categoria não encontrada')
    const usage = await categoryUsage(client, existing.name)
    if (categoryInUse(usage)) {
      throw new AppError(
        409,
        'CATEGORY_IN_USE',
        'Não é possível remover: existem equipes, jogos, horários ou janelas de inscrição cadastrados nesta categoria. Desative-a em vez de remover.',
      )
    }
    await client.query('DELETE FROM categories WHERE id = $1', [existing.id])
    await audit(client, req.user, 'category.delete', 'category', existing.id, { name: existing.name })
  })
  res.json({ ok: true })
}))
