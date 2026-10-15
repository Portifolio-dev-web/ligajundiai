FROM node:20-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json ./
RUN corepack enable && yarn install --non-interactive

COPY . .

EXPOSE 3000

CMD ["yarn", "dev:no-reload"]
