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
function buildCsp(nonce) {
  const storageOrigin = process.env.STORAGE_PUBLIC_ORIGIN || 'http://localhost:9000'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // style-src com 'unsafe-inline': os componentes usam a prop "style" do React em vários pontos
    // (app/page.js). Estilo inline não executa código, diferente de script inline — risco aceitável.
    "style-src 'self' 'unsafe-inline'",
    // blob: é usado pelo preview da foto capturada pela câmera (CameraCapture.jsx, URL.createObjectURL);
    // o domínio do Unsplash é usado pelas imagens de capa do site (app/page.js).
    'img-src \'self\' blob: data: https://images.unsplash.com',
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

export async function middleware(request) {
  // O nonce agora é gerado para TODA requisição de página (matcher abaixo), não só para as rotas
  // protegidas por papel — um CSP real precisa valer no site inteiro, inclusive na home e no
  // cadastro público de atleta.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const requiredRole = roleForPath(request.nextUrl.pathname)
  if (requiredRole) {
    const session = request.cookies.get('lvj_session')?.value
    const payload = session ? await verifySession(session) : null
    if (!payload) {
      const destination = new URL('/', request.url)
      destination.searchParams.set('next', request.nextUrl.pathname)
      return applyCsp(NextResponse.redirect(destination), nonce)
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowedRoles.includes(payload.role)) {
      const destination = new URL(payload.role === 'admin' ? '/admin/aprovacoes' : `/${payload.role}`, request.url)
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
