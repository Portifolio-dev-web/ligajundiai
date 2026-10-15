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

export function isValidCpf(input) {
  const cpf = String(input ?? '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  for (let digit = 9; digit < 11; digit += 1) {
    let sum = 0
    for (let i = 0; i < digit; i += 1) sum += Number(cpf[i]) * (digit + 1 - i)
    const result = (sum * 10) % 11
    if (Number(cpf[digit]) !== (result === 10 ? 0 : result)) return false
  }
  return true
}

export function requireValidCpf(input) {
  const cpf = String(input ?? '').replace(/\D/g, '')
  if (!isValidCpf(cpf)) throw new AppError(400, 'INVALID_CPF', 'CPF inválido')
  return cpf
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
