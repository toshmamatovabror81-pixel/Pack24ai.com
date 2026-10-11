# Pack24 sayti: Next.js standalone server + Prisma (migratsiya va seed uchun CLI)
# Build:  docker compose build
# Run:    docker compose up -d

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1) Bog'liqliklar
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2) Faqat production bog'liqliklar: Prisma CLI (migrate deploy, db execute) shu yerdan olinadi
FROM base AS prodeps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# 3) Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build vaqtida bazaga ulanilmaydi, lekin Prisma klienti ishga tushishi uchun qiymat kerak
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-only-secret-build-only-secret-0000
RUN npx prisma generate && npm run build

# 4) Ishga tushadigan image
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app && mkdir -p /data/uploads && chown -R app:app /data

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Prisma CLI va migratsiyalar (alohida cli/ papkada, standalone node_modules bilan aralashmaydi)
COPY --from=builder --chown=app:app /app/prisma ./prisma
COPY --from=prodeps --chown=app:app /app/node_modules ./cli/node_modules
COPY --from=builder --chown=app:app /app/deploy/entrypoint.sh /app/deploy/seed-if-empty.mjs ./deploy/
RUN chmod +x ./deploy/entrypoint.sh

USER app
EXPOSE 3000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./deploy/entrypoint.sh"]
