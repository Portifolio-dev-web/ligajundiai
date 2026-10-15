import { NextResponse } from 'next/server'

const protectedRoles = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/gestor', roles: ['gestor'] },
  { prefix: '/atleta', roles: ['atleta'] },
  { prefix: '/cadastro-atleta', roles: ['gestor', 'atleta'] },
]

export async function middleware(request) {
  const required = protectedRoles.find(({ prefix }) =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  )
  if (!required) return NextResponse.next()

  const cookie = request.headers.get('cookie')
  if (!cookie) return redirectToLogin(request, 'required')

  const apiOrigin = process.env.API_INTERNAL_URL || 'http://localhost:4000'
  let response
  try {
    response = await fetch(`${apiOrigin}/api/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return new NextResponse('O serviço de autenticação está indisponível.', { status: 503 })
  }

  if (response.status === 401 || response.status === 403) {
    return redirectToLogin(request, 'required')
  }
  if (!response.ok) {
    return new NextResponse('Não foi possível validar sua sessão.', { status: 503 })
  }

  const { user } = await response.json()
  if (!user?.role) return redirectToLogin(request, 'required')
  if (!required.roles.includes(user.role)) return redirectToLogin(request, 'forbidden')

  return NextResponse.next()
}

function redirectToLogin(request, reason) {
  const url = new URL('/', request.url)
  url.searchParams.set('auth', reason)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*', '/gestor/:path*', '/atleta/:path*', '/cadastro-atleta'],
}
