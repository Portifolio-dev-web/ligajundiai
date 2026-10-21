FROM node:20-bookworm-slim AS development

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json ./
RUN corepack enable && yarn install --non-interactive

COPY . .

EXPOSE 3000

CMD ["yarn", "dev:no-reload"]

# SEGURANÇA (varredura, item S5): antes este Dockerfile só tinha o estágio acima — qualquer build
# "de produção" feito a partir dele continuava rodando `next dev` (mais lento, sem as otimizações do
# `next build`, e sem o CSP restrito, que só desliga 'unsafe-eval' quando NODE_ENV=production;
# `next dev` sempre usa eval()). Este estágio builda de verdade.
FROM development AS build
ENV NODE_ENV=production
RUN yarn build

# SEGURANÇA (varredura, itens S5 e S9): imagem final mínima (só o output "standalone" do Next,
# sem o código-fonte nem as devDependencies) e processo roda como usuário dedicado, não root — um
# RCE via dependência não ganha privilégio total no container.
FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 10002 nextjs && useradd --system --uid 10002 --gid nextjs nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
