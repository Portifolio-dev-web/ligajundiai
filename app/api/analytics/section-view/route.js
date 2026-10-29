import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ALLOWED_SECTION_IDS } from '@/lib/sectionAnalytics'

// ARQUITETURA: toda a API real da LVJ mora no backend Express (backend/src/routes) e chega aqui
// só via rewrite (next.config.js: /api/:path* -> API_INTERNAL_URL) — rotas do próprio Next em
// app/api, por serem arquivo estático, são resolvidas antes dessa rewrite, então esta é a única
// exceção deliberada a essa regra. "Visualização de seção" ainda não é dado de negócio da liga
// (não há tabela no Postgres do backend) — é telemetria de front-end, por ora só registrada no
// log do servidor (ver console.info abaixo). Se a métrica for promovida de experimento a produto,
// o INSERT real nasce em backend/src/routes/*, não aqui.
const sectionViewSchema = z
  .object({
    sectionId: z.enum(ALLOWED_SECTION_IDS),
    // SEGURANÇA: inteiro, não-negativo e com teto de 24h — impede que um payload malicioso ou um
    // cronômetro com bug poluam o log (ou um futuro INSERT) com valores negativos, fracionários
    // ou absurdamente grandes.
    timeSpentInSeconds: z.number().int().nonnegative().max(86400),
  })
  // .strict(): rejeita qualquer campo além destes dois, mesmo não-mapeados aqui — mesmo padrão de
  // backend/src/security/validation.js (ver justificationSchema).
  .strict()

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido.' }, { status: 400 })
  }

  const result = sectionViewSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Dados inválidos',
        issues: result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      },
      { status: 400 },
    )
  }

  console.info('[analytics] section_view', result.data)
  return new NextResponse(null, { status: 204 })
}
