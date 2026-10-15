FROM node:22-bookworm-slim AS development
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./

FROM development AS production
RUN npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
