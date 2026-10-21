import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

export function encryptSensitive(value) {
  if (!value) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', config.encryptionKey, iv)
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decryptSensitive(value) {
  if (!value) return null
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) {
    throw new Error('Invalid encrypted value')
  }
  const decipher = createDecipheriv('aes-256-gcm', config.encryptionKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function rgDigest(rg) {
  return createHash('sha256').update(rg).digest('hex')
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

// Decisão (análise LVJ 2027, risco 1): RG no lugar do CPF — sem formato nacional fixo (cada
// estado emite o seu), então a máscara não assume tamanho ou pontuação, só revela os últimos
// 3 caracteres.
export function maskRg(rg) {
  if (!rg) return null
  const visible = rg.slice(-3)
  return `${'*'.repeat(Math.max(rg.length - visible.length, 3))}${visible}`
}
