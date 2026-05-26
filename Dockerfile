FROM node:22-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ARG NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=${NEXT_PROXY_CLIENT_MAX_BODY_SIZE}
ENV APP_BASE_URL=http://localhost:3000
ENV DATABASE_URL=postgresql://sapen_annotate:placeholder@postgres:5432/sapen_annotate?schema=public
ENV S3_ENDPOINT=http://minio:9000
ENV S3_ACCESS_KEY=placeholder
ENV S3_SECRET_KEY=placeholder
ENV S3_BUCKET=sapen-annotate-build
ENV S3_REGION=us-east-1
ENV S3_FORCE_PATH_STYLE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000
CMD ["npm", "run", "start"]
