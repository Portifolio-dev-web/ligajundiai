FROM node:22-bookworm-slim AS development
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./

FROM development AS production
RUN npm prune --omit=dev
ENV NODE_ENV=production
# SEGURANÇA (varredura, item S9): processo roda como usuário dedicado, não root — um RCE via
# dependência não ganha privilégio total no container.
RUN groupadd --system --gid 10001 lvj && useradd --system --uid 10001 --gid lvj lvj \
  && chown -R lvj:lvj /app/backend
USER lvj
EXPOSE 4000
# SEGURANÇA (varredura, item S24): sem HEALTHCHECK na própria imagem, só quem rodasse exatamente
# este compose.yaml (serviço "api") tinha sonda de vivacidade — fora dele (outro orquestrador,
# "docker run" direto), nada detecta o processo travado. Mesmo endpoint e técnica (fetch nativo do
# Node, sem depender de curl/wget na imagem slim) do healthcheck que já existia só no compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["npm", "start"]
