import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import IORedis from 'ioredis'
import { config } from '../config.js'

const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
const storeFor = (prefix) => config.NODE_ENV === 'test' ? undefined : new RedisStore({
  prefix,
  sendCommand: (...args) => redis.call(...args),
})

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  store: storeFor('lvj:api:'),
  message: { error: 'Limite de requisições excedido. Tente novamente mais tarde.' },
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: storeFor('lvj:auth:'),
  message: { error: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' },
})

export async function closeRateLimitStore() {
  if (redis.status !== 'end') await redis.quit()
}
