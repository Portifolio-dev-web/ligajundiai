FROM node:20-bookworm-slim AS development

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# SEGURANÇA (varredura, item S8): --frozen-lockfile falha o build se package.json e yarn.lock
# divergirem, em vez de resolver versões novas silenciosamente dentro das faixas semver — sem
# lockfile versionado antes, cada build podia trazer dependências diferentes das da última vez.
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --non-interactive --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["yarn", "dev:no-reload"]

# SEGURANÇA (varredura, item S5): antes este Dockerfile só tinha o estágio acima — qualquer build
# "de produção" feito a partir dele continuava rodando `next dev` (mais lento, sem as otimizações do
# `next build`, e sem o CSP restrito, que só desliga 'unsafe-eval' quando NODE_ENV=production;
# `next dev` sempre usa eval()). Este estágio builda de verdade.
# CORREÇÃO (achado ao verificar o item S18 em produção): next.config.js lê API_INTERNAL_URL dentro
# de rewrites() para decidir para onde /api/* é encaminhado — o Next resolve isso durante o build
# (next build), não a cada requisição, então a variável de ambiente passada só em "docker run"
# nunca chegava a valer; o destino ficava preso no padrão de desenvolvimento (localhost:4000), que
# não existe dentro do container em produção (API e frontend não compartilham localhost).
FROM development AS build
ARG API_INTERNAL_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL
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
# SEGURANÇA (varredura, item S11): public/images agora existe (fotos da home autohospedadas, em
# vez de hotlink) — precisa ir para a imagem final, senão as imagens da home voltam a 404.
COPY --from=build --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
# SEGURANÇA (varredura, item S24): sem HEALTHCHECK na imagem, nada detecta o processo travado fora
# do compose.yaml local (que nem tinha healthcheck pra este serviço). Não existe endpoint dedicado
# de saúde no frontend — GET / já exercita o server Next padrão de pé.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
