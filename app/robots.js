// SEO (varredura, item E2): sem robots.txt o Google tende a tentar indexar qualquer rota que
// encontre, inclusive as protegidas por papel (/admin, /gestor, /atleta) — o middleware.js
// redireciona o crawler para "/", o que é só desperdício de orçamento de rastreamento, não um
// risco de dado exposto (a tela em si exige login). "/api" fica de fora porque não é conteúdo.
export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/gestor', '/atleta', '/api'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
