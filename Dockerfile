# syntax=docker/dockerfile:1
#
# Imagen de producción de la web (apps/web) para Easypanel.
# Guía: docs/despliegue-vps.md · Decisión: docs/decisiones/0011-alojamiento-vps-propio.md
#
# Build args (las NEXT_PUBLIC_* se incrustan en el JavaScript durante el build):
#   NEXT_PUBLIC_ZKPASSPORT_DOMAIN    obligatorio, p. ej. civora.nexuraia.com
#   NEXT_PUBLIC_ZKPASSPORT_DEV_MODE  "true" o "false" (por defecto "false")
# El resto de variables (secretos, RPC, contrato) se definen al ejecutar.

# Node 22 LTS fijado por versión y digest: el build no cambia aunque se
# publique otra imagen con la misma etiqueta. Para actualizar, cambia ambos.
ARG NODE_IMAGE=node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

# ---------- Dependencias: solo lo que fija pnpm-lock.yaml ----------
FROM ${NODE_IMAGE} AS dependencias
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# corepack instala la versión exacta de "packageManager" (pnpm@9.0.0).
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/zk-identity/package.json packages/zk-identity/
# --filter web... instala la web y sus paquetes del workspace (no Hardhat).
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false --filter "web..."

# ---------- Build ----------
FROM dependencias AS build
ARG NEXT_PUBLIC_ZKPASSPORT_DOMAIN
ARG NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false
ENV NEXT_PUBLIC_ZKPASSPORT_DOMAIN=${NEXT_PUBLIC_ZKPASSPORT_DOMAIN} \
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=${NEXT_PUBLIC_ZKPASSPORT_DEV_MODE} \
    CIVORA_STANDALONE=true
RUN test -n "$NEXT_PUBLIC_ZKPASSPORT_DOMAIN" || (echo "Falta el build arg NEXT_PUBLIC_ZKPASSPORT_DOMAIN" >&2 && exit 1)
COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/shared-types packages/shared-types
COPY packages/zk-identity packages/zk-identity
RUN pnpm --filter web build && node apps/web/scripts/preparar-standalone.mjs

# ---------- Imagen final mínima ----------
FROM ${NODE_IMAGE} AS final
ARG NEXT_PUBLIC_ZKPASSPORT_DOMAIN
ARG NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=false
# Los mismos valores que se compilaron, para que arranque.js los valide.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_ZKPASSPORT_DOMAIN=${NEXT_PUBLIC_ZKPASSPORT_DOMAIN} \
    NEXT_PUBLIC_ZKPASSPORT_DEV_MODE=${NEXT_PUBLIC_ZKPASSPORT_DEV_MODE}
WORKDIR /app
# Solo la salida standalone ya preparada: server.js, node_modules trazados,
# .next/static, public, lib/certificados-raiz y arranque.js. Los archivos
# pertenecen a root y el proceso corre como "node": no puede modificarlos.
COPY --from=build /app/apps/web/.next/standalone ./
WORKDIR /app/apps/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/salud').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "arranque.js"]
