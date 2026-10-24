import { NextResponse } from 'next/server'

const roleForPath = (pathname) => {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/gestor')) return 'gestor'
  if (pathname.startsWith('/atleta')) return 'atleta'
  if (pathname.startsWith('/jogos')) return ['gestor', 'atleta']
  return null
}

// SEGURANÇA (varredura, item S4): antes o único CSP do site vinha do next.config.js, fixo em
// "frame-ancestors 'none'" — sem script-src/default-src, ou seja, sem proteção real contra XSS.
// Um CSP de verdade precisa restringir script-src, e isso só é seguro com um nonce DIFERENTE a
// cada requisição (gerado aqui, no middleware, que roda por requisição — nunca num arquivo
// estático como o next.config.js: um nonce fixo apareceria no HTML e qualquer script injetado
// poderia reaproveitar o mesmo valor, anulando a proteção).
//
// "strict-dynamic" deixa os scripts que o próprio Next.js injeta (chunk do app, carregamento de
// rotas) funcionarem normalmente: um script com nonce válido pode carregar outros scripts, mas um
// script injetado por um ataque de XSS (sem o nonce) não pode.
//
// STORAGE_PUBLIC_ORIGIN precisa ser a mesma origem (esquema+host+porta) de S3_PUBLIC_ENDPOINT do
// backend (backend/.env.example) — é para lá que o navegador envia a foto biométrica direto
// (CameraCapture.jsx), sem passar pela API. Se as duas divergirem em produção, o envio da foto
// passa a ser bloqueado pelo CSP.
//
// CORREÇÃO (achado ao testar localmente): em "next dev" o webpack roda os módulos com eval() (é o
// devtool padrão de desenvolvimento, para o hot-reload ser rápido) — sem 'unsafe-eval' no
// script-src, o app trava com a tela de carregamento para sempre, porque o próprio runtime do
// Next.js é bloqueado pelo CSP antes de conseguir rodar. "next build" (produção) não usa eval(),
// então só relaxamos o CSP quando NODE_ENV não é "production" — em produção o script-src continua
// só com nonce + strict-dynamic, sem unsafe-eval. O HMR do webpack também abre um WebSocket na
// própria origem (ws://…/_next/webpack-hmr); 'self' em connect-src já cobre esse esquema.
function buildCsp(nonce) {
  const storageOrigin = process.env.STORAGE_PUBLIC_ORIGIN || 'http://localhost:9000'
  const isDev = process.env.NODE_ENV !== 'production'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // style-src com 'unsafe-inline': os componentes usam a prop "style" do React em vários pontos
    // (app/page.js). Estilo inline não executa código, diferente de script inline — risco aceitável.
    "style-src 'self' 'unsafe-inline'",
    // blob: é usado pelo preview da foto capturada pela câmera (CameraCapture.jsx, URL.createObjectURL).
    // SEGURANÇA (varredura, item S11): as imagens de capa do site (app/page.js) eram hotlinked de
    // images.unsplash.com — cada visita entregava o IP de quem acessa à Unsplash. Agora são
    // arquivos locais em public/images, então 'self' já cobre, sem precisar liberar domínio externo.
    'img-src \'self\' blob: data:',
    "font-src 'self'",
    `connect-src 'self' ${storageOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function verifySession(token) {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])))
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])))
    if (header.alg !== 'HS256' || header.typ && header.typ !== 'JWT') return null
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    if (!valid || !payload.sub || !payload.jti || !payload.exp || payload.exp <= Date.now() / 1000) return null
    if (payload.iss !== 'ligajundiai-api') return null
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!audiences.includes('ligajundiai-web')) return null
    if (!['admin', 'gestor', 'atleta'].includes(payload.role)) return null
    return payload
  } catch {
    return null
  }
}

// SEGURANÇA (varredura, item C1): verifySession só confere assinatura e validade do token — não
// dá para consultar a tabela "sessions" daqui (roda no Edge, sem acesso ao Postgres). Isso significa
// que, depois de um logout ou de uma revogação feita pelo admin, o cookie antigo (ainda válido como
// JWT) continuava passando por esta guarda de rota até expirar (até 8h), embora toda chamada de API
// real já falhasse certo no backend (authenticate checa "revoked_at"). Ou seja, nenhum dado real
// chegava a vazar — só a casca da tela ficava visível por mais tempo que o necessário.
//
// Esta função fecha essa janela perguntando ao próprio backend (GET /auth/me, que já faz essa
// checagem) se a sessão ainda está ativa. Importante: só tratamos como "deslogado" quando o backend
// responde que não (fail-closed nesse caso). Se a chamada falhar ou der timeout (backend fora do ar,
// rede lenta), seguimos com o que o JWT local já confirmou (fail-open) — um problema de
// infraestrutura não deve travar o acesso de quem está realmente logado.
async function isSessionStillActive(cookieHeader) {
  const apiOrigin = process.env.API_INTERNAL_URL || 'http://localhost:4000'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)
  try {
    const response = await fetch(`${apiOrigin}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      signal: controller.signal,
    })
    // GET /auth/me usa authenticateIfPresent: sem cookie, responde 200 {user: null}; com cookie
    // válido, 200 {user: {...}}; com cookie revogado/expirado, authenticate() lança erro -> 401.
    // Só o 401 é um "não" explícito do backend (fail-closed). Qualquer outro status (502, 503...)
    // é problema de infraestrutura, não revogação — cai no fail-open abaixo.
    if (response.status === 401) return false
    if (!response.ok) return true
    const data = await response.json()
    return Boolean(data?.user)
  } catch {
    return true
  } finally {
    clearTimeout(timeout)
  }
}

// SEGURANÇA (varredura, item S4): applyCsp centraliza os cabeçalhos para não esquecer nenhum
// deles em algum dos retornos (redirecionamento ou passagem normal) da função abaixo.
function applyCsp(response, nonce) {
  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // camera=(self): a câmera é usada de propósito (foto biométrica, CameraCapture.jsx); o resto
  // (microfone, geolocalização, pagamento, USB) não tem uso no site e fica desligado.
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  return response
}

// SEGURANÇA (varredura, item S18): precisa ser o MESMO nome que o backend usa (security/auth.js,
// sessionCookieName) — COOKIE_SECURE aqui é passado pelo ambiente do serviço "frontend" no
// compose.yaml e precisa bater com o do serviço "api", senão o middleware procura o cookie errado.
function sessionCookieName() {
  return process.env.COOKIE_SECURE === 'true' ? '__Host-lvj_session' : 'lvj_session'
}

export async function middleware(request) {
  // O nonce agora é gerado para TODA requisição de página (matcher abaixo), não só para as rotas
  // protegidas por papel — um CSP real precisa valer no site inteiro, inclusive na home e no
  // cadastro público de atleta.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  // SEGURANÇA/ARQUITETURA (refatoração 2026-10-23): o Painel Administrativo morava embutido em "/"
  // (app/page.js), atrás só de uma checagem client-side — o HTML/JS da tela baixava no navegador de
  // qualquer visitante antes mesmo de existir uma sessão para checar. Agora vive em /admin, protegido
  // como qualquer rota de papel (bloco abaixo). Esta checagem evita a volta visual a "/" para quem já
  // está autenticado como admin: o Edge redireciona antes do React montar. Só roda quando existe
  // cookie de sessão — quem nunca logou não paga o custo extra de verificar o JWT.
  if (request.nextUrl.pathname === '/') {
    const homeSession = request.cookies.get(sessionCookieName())?.value
    const homePayload = homeSession ? await verifySession(homeSession) : null
    if (homePayload?.role === 'admin') {
      return applyCsp(NextResponse.redirect(new URL('/admin', request.url)), nonce)
    }
  }

  const requiredRole = roleForPath(request.nextUrl.pathname)
  if (requiredRole) {
    const session = request.cookies.get(sessionCookieName())?.value
    const payload = session ? await verifySession(session) : null
    if (!payload) {
      const destination = new URL('/', request.url)
      destination.searchParams.set('next', request.nextUrl.pathname)
      return applyCsp(NextResponse.redirect(destination), nonce)
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowedRoles.includes(payload.role)) {
      const destination = new URL(payload.role === 'admin' ? '/admin' : `/${payload.role}`, request.url)
      return applyCsp(NextResponse.redirect(destination), nonce)
    }

    // SEGURANÇA (varredura, item C1): só nas rotas protegidas por papel, depois que o JWT local já
    // passou — aqui vale pagar uma chamada extra ao backend para fechar a janela de sessão revogada.
    if (!(await isSessionStillActive(request.headers.get('cookie') || ''))) {
      const destination = new URL('/', request.url)
      destination.searchParams.set('next', request.nextUrl.pathname)
      return applyCsp(NextResponse.redirect(destination), nonce)
    }
  }

  // Repassa x-nonce na requisição (não só na resposta) para o layout.js conseguir lê-lo via
  // headers() e aplicar o mesmo nonce no único <script> inline da página.
  return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce)
}

export const config = {
  // Roda em toda página (para o CSP valer em todo o site) menos em /api (a API já define os
  // próprios cabeçalhos de segurança no backend, via helmet) e nos arquivos internos do Next.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
