const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
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
