import { Parser } from 'htmlparser2'
import { z } from 'zod'
import { AppError } from '../errors.js'

export function cleanText(value, maxLength = 200) {
  if (typeof value !== 'string') return value
  let text = ''
  const parser = new Parser({ ontext: (fragment) => { text += fragment } }, { decodeEntities: true })
  parser.end(value)
  return text.trim().slice(0, maxLength)
}

export function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos', result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })))
  }
  return result.data
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const uuidSchema = z.string().uuid()

// Decisão (análise LVJ 2027, risco 1): identificação por RG, não mais por CPF. Diferente do
// CPF, o RG não tem um algoritmo de dígito verificador nacional — cada estado emite no seu
// próprio formato —, então só validamos uma faixa de tamanho plausível, com o dígito
// verificador alfabético "X" (comum em SP/RJ/MG) aceito no último caractere.
export function isValidRg(input) {
  const rg = String(input ?? '').toUpperCase().replace(/[^0-9X]/g, '')
  return /^\d{5,9}X?$/.test(rg)
}

export function requireValidRg(input) {
  const rg = String(input ?? '').toUpperCase().replace(/[^0-9X]/g, '')
  if (!isValidRg(rg)) throw new AppError(400, 'INVALID_RG', 'RG inválido')
  return rg
}

export function validatePositions(positions) {
  const valid = new Set(['central', 'ponteiro', 'saida', 'levantador', 'libero'])
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > valid.size ||
      positions.some((position) => !valid.has(position)) ||
      new Set(positions).size !== positions.length) {
    throw new AppError(400, 'INVALID_POSITIONS', 'Informe pelo menos uma posição válida')
  }
  return positions
}
