import { NextResponse } from 'next/server'

const roleForPath = (pathname) => {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/gestor')) return 'gestor'
  if (pathname.startsWith('/atleta')) return 'atleta'
  if (pathname.startsWith('/jogos')) return ['gestor', 'atleta']
  return null
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

export async function middleware(request) {
  const requiredRole = roleForPath(request.nextUrl.pathname)
  if (!requiredRole) return NextResponse.next()

  const session = request.cookies.get('lvj_session')?.value
  const payload = session ? await verifySession(session) : null
  if (!payload) {
    const destination = new URL('/', request.url)
    destination.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(destination)
  }

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  if (!allowedRoles.includes(payload.role)) {
    const destination = new URL(payload.role === 'admin' ? '/admin/aprovacoes' : `/${payload.role}`, request.url)
    return NextResponse.redirect(destination)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/gestor/:path*', '/atleta/:path*', '/jogos/:path*'],
}
