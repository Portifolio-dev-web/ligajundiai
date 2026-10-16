import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12),
  ADMIN_TOTP_SECRET: z.string().min(16),
  CONSENT_VERSION: z.string().min(1).default('2026-01'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().email().default('nao-responda@lvj.local'),
  S3_ENDPOINT: z.string().url(),
  S3_INTERNAL_ENDPOINT: z.string().url(),
  S3_PUBLIC_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  CONTROL_ID_MODE: z.enum(['simulation', 'live']).default('simulation'),
  CONTROL_ID_API_URL: z.string().default(''),
  CONTROL_ID_API_KEY: z.string().default(''),
  WEBHOOK_SECRET: z.string().min(32),
})

export const config = schema.parse(process.env)

const encryptionKey = Buffer.from(config.APP_ENCRYPTION_KEY, 'base64')
if (encryptionKey.length !== 32) {
  throw new Error('APP_ENCRYPTION_KEY must be base64-encoded and decode to exactly 32 bytes')
}
config.encryptionKey = encryptionKey

if (config.NODE_ENV === 'production' && config.CONTROL_ID_MODE === 'live') {
  if (!config.CONTROL_ID_API_URL || !config.CONTROL_ID_API_KEY) {
    throw new Error('CONTROL_ID_API_URL and CONTROL_ID_API_KEY are required in live mode')
  }
}

// SEGURANÇA (varredura, item S2): antes, COOKIE_SECURE default "false" valia também em produção
// se alguém esquecesse de defini-lo no deploy, e o cookie de sessão saía sem o atributo Secure.
// Agora falha o boot (fail-closed), igual já acontecia com CONTROL_ID_MODE acima.
if (config.NODE_ENV === 'production' && !config.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE must be "true" in production; the session cookie cannot be sent without the Secure attribute')
}

export const allowedOrigins = config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
