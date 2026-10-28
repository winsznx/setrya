# Build context: repository root.
FROM node:22.23.3-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/security/package.json packages/security/
COPY packages/wallet-adapter/package.json packages/wallet-adapter/
RUN pnpm install --frozen-lockfile --filter "@setrya/api..."
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @setrya/api build

FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production SETRYA_MIGRATIONS_DIR=/app/migrations
WORKDIR /app
# Only the modules the bundle leaves external: the native Argon2 binding, the Postgres driver and the CommonJS QR encoder.
RUN echo '{"name":"setrya-api","private":true,"type":"module"}' > package.json \
 && npm install --omit=dev --no-audit --no-fund @node-rs/argon2@2.0.2 postgres@3.4.7 qrcode@1.5.4 && npm cache clean --force
COPY --from=build /repo/apps/api/dist ./dist
COPY packages/db/migrations ./migrations
USER node
EXPOSE 8444
CMD ["node", "--enable-source-maps", "dist/main.js"]
