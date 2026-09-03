# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../db/custom.db"
RUN npm run build

# --- run ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# NOTE: the SQLite path is baked into prisma/schema.prisma (url = "file:./custom.db"),
# so no DATABASE_URL is required. If you switch the schema to env("DATABASE_URL")
# (e.g. for Postgres), set it here:
# ENV DATABASE_URL="postgresql://user:pass@host:5432/db"
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
