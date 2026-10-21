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
CMD ["npm", "start"]
