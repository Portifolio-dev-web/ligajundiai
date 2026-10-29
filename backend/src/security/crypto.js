import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'
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

// SEGURANÇA (varredura, item 2): RG tem um espaço de busca pequeno (5 a 9 dígitos + "X" opcional,
// ver security/validation.js — 2.222.200.000 valores possíveis). Um SHA-256 sem chave sobre esse
// espaço permitia reverter qualquer rg_hash vazado por força bruta (minutos numa CPU comum,
// segundos numa GPU), sem precisar de APP_ENCRYPTION_KEY — derrotando a criptografia do
// rg_ciphertext por um caminho totalmente diferente. A chave do HMAC é derivada por HKDF a partir
// de APP_ENCRYPTION_KEY, com um rótulo próprio ("lvj-rg-digest-v1") para não reaproveitar a mesma
// chave do AES-256-GCM acima em outro algoritmo. Trocar o algoritmo exige rehashear os rg_hash já
// gravados — ver backend/src/db/rehash-rg-digest.js (execução única, depois de atualizar o código).
const rgDigestKey = Buffer.from(hkdfSync('sha256', config.encryptionKey, Buffer.alloc(0), Buffer.from('lvj-rg-digest-v1'), 32))

export function rgDigest(rg) {
  return createHmac('sha256', rgDigestKey).update(rg).digest('hex')
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
