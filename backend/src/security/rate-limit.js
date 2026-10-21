import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
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

// SEGURANÇA (varredura, item S14): authRateLimit acima só limita por IP — quem distribui as
// tentativas entre vários IPs não tinha limite nenhum contra um e-mail específico. Esta chave pela
// própria conta, não pelo IP de quem pede.
export const loginAccountRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  keyGenerator: (req) => `login:${String(req.body?.email || '').trim().toLowerCase()}`,
  store: storeFor('lvj:login-account:'),
  message: { error: 'Muitas tentativas de login para esta conta. Tente novamente mais tarde.' },
})

// SEGURANÇA (varredura, item S16): a exportação completa dos dados do titular (GET /privacy/export)
// só exigia sessão válida, sem limite próprio — uma sessão vazada/roubada raspava os dados quantas
// vezes quisesse. Chave pelo usuário autenticado, não pelo IP (várias contas no mesmo IP não se
// afetam, e trocar de IP não reseta o limite da própria conta).
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  // req.user sempre existe aqui (rota atrás de authenticate); o fallback por IP normalizado
  // (ipKeyGenerator) só evita o aviso de validação do express-rate-limit sobre IPv6.
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  store: storeFor('lvj:export:'),
  message: { error: 'Limite de exportações de dados excedido. Tente novamente mais tarde.' },
})

export async function closeRateLimitStore() {
  if (redis.status !== 'end') await redis.quit()
}
