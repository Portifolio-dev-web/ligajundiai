const nextConfig = {
  output: 'standalone',
  // PERFORMANCE (varredura, item I3): antes "unoptimized: true" desligava a otimização de imagem
  // do Next inteira (nenhum resize/WebP automático) — era herdada de quando o site usava <img> cru
  // com fotos hotlinked (ver item S12, histórico). Agora app/page.js usa next/image com as fotos
  // locais em public/images; sem remotePatterns porque não há mais nenhuma imagem de domínio
  // externo. O otimizador usa o pacote "sharp" (já presente em node_modules como dependência
  // opcional do Next) e roda dentro do próprio container de build/produção — sem dependência de
  // serviço externo.
  images: {},
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // SEGURANÇA (varredura, item S4): o Content-Security-Policy real (com nonce por requisição,
    // script-src, connect-src etc.) agora é gerado no middleware.js, que roda por requisição —
    // aqui só fica o X-Frame-Options como reforço estático para navegadores sem suporte a CSP
    // (e para as rotas que o matcher do middleware deliberadamente não cobre, como /api).
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  async rewrites() {
    const apiOrigin = process.env.API_INTERNAL_URL || 'http://localhost:4000'
    return [{
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`,
    }]
  },
};

module.exports = nextConfig;
