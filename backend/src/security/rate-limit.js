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
  // TESTES (achado ao escrever a suíte Playwright, 2026-10-24): este era o único limitador do
  // arquivo sem o "skip" por NODE_ENV=test — uma suíte E2E cobrindo o app inteiro (cada navegação
  // de página já dispara várias chamadas de API) passa de 300 requisições/15min rapidinho, e
  // qualquer rerun durante o desenvolvimento dos testes caía bloqueado pelo limite da rodada
  // anterior. Mesmo padrão dos demais limitadores abaixo: continua valendo de verdade em
  // desenvolvimento/produção, só não em NODE_ENV=test.
  skip: (req) => req.path === '/health' || config.NODE_ENV === 'test',
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

// SEGURANÇA (varredura, item S22): POST /auth/otp/request só tinha o limite por IP compartilhado
// de authRateLimit — quem distribuísse o pedido entre vários IPs mandava quantos códigos quisesse
// para a caixa de entrada de uma vítima (email bombing), sem teto por e-mail de destino. Limite
// mais baixo que o de login (5, não 10): cada pedido aqui dispara um e-mail de verdade, custo maior
// que uma tentativa de senha.
export const otpRequestAccountRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  keyGenerator: (req) => `otp:${String(req.body?.email || '').trim().toLowerCase()}`,
  store: storeFor('lvj:otp-account:'),
  message: { error: 'Muitos pedidos de código de acesso para esta conta. Tente novamente mais tarde.' },
})

// SEGURANÇA: POST /auth/forgot-password/request dispara um SMS de verdade (ou, para admin, só
// confirma o método) — mesmo risco de email bombing do item S22 acima, agora por SMS. Limite igual
// ao de otpRequestAccountRateLimit, pela mesma razão (custo maior que uma tentativa de senha).
export const forgotPasswordRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  keyGenerator: (req) => `forgot-password-request:${String(req.body?.email || '').trim().toLowerCase()}`,
  store: storeFor('lvj:forgot-password-request:'),
  message: { error: 'Muitos pedidos de recuperação de senha para esta conta. Tente novamente mais tarde.' },
})

// SEGURANÇA: POST /auth/forgot-password/verify aceita um código TOTP ou SMS de 6 dígitos — sem
// limite por conta, alguém distribuindo tentativas entre IPs tinha, na prática, tentativas
// ilimitadas para adivinhar o código (o limite de 5 tentativas em otp_codes.attempts só vale para
// o código SMS, não para o TOTP do admin, que não expira por uso).
export const forgotPasswordVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  keyGenerator: (req) => `forgot-password-verify:${String(req.body?.email || '').trim().toLowerCase()}`,
  store: storeFor('lvj:forgot-password-verify:'),
  message: { error: 'Muitas tentativas de verificação. Tente novamente mais tarde.' },
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
