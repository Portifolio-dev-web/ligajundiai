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
  // Teste: a suíte de integração roda com --runInBand (um processo só, sem Redis), então o
  // MemoryStore acima soma as chamadas de TODOS os testes do arquivo — sem isso, qualquer teste
  // novo que registre uma conta ou peça upload de biometria estoura o limite de outro teste sem
  // relação nenhuma com ele. Nenhum teste verifica o 429 em si; produção (NODE_ENV=production ou
  // development) continua com o limite de 10/15min de verdade.
  skip: () => config.NODE_ENV === 'test',
  store: storeFor('lvj:auth:'),
  message: { error: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' },
})

export async function closeRateLimitStore() {
  if (redis.status !== 'end') await redis.quit()
}
