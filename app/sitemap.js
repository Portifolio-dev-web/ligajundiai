// SEO (varredura, item E2): só as rotas públicas (sem exigência de login) entram aqui. As rotas
// por papel (/admin, /gestor, /atleta) ficam de fora de propósito — ver app/robots.js: indexá-las
// só faria o Google gastar rastreamento numa URL que o middleware.js redireciona para "/".
export default function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const routes = [
    { path: '/', priority: 1 },
    { path: '/cadastro-atleta', priority: 0.6 },
    { path: '/ajuda', priority: 0.4 },
    { path: '/privacidade', priority: 0.3 },
    { path: '/termos-de-uso', priority: 0.3 },
  ]
  return routes.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'weekly',
    priority,
  }))
}
