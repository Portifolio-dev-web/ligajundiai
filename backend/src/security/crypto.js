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

export function cpfDigest(cpf) {
  return createHash('sha256').update(cpf).digest('hex')
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function maskCpf(cpf) {
  return cpf ? `***.***.${cpf.slice(-5, -2)}-${cpf.slice(-2)}` : null
}
