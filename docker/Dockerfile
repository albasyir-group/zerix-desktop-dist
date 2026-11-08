# syntax=docker/dockerfile:1
#
# Build context: a checkout of the private source repo.
# Helper files come from the named context `dist`:
#   docker build -f dist/docker/Dockerfile --build-context dist=dist/docker ... source

# ---- build: compile and pack the npm tarballs (glibc, full toolchain) ----
FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build

ARG PLATFORM_ORIGIN
ARG INFERENCE_ORIGIN
RUN case "$PLATFORM_ORIGIN" in https://?*) ;; *) echo "PLATFORM_ORIGIN must be https://..." >&2; exit 1 ;; esac \
 && case "$INFERENCE_ORIGIN" in https://?*) ;; *) echo "INFERENCE_ORIGIN must be https://..." >&2; exit 1 ;; esac

RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV CI=true DSH_TELEMETRY_DISABLED=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1

WORKDIR /src
COPY . .

RUN set -eu; \
    version="$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")"; \
    corepack enable; \
    corepack prepare "pnpm@${version}" --activate; \
    test "$(pnpm --version)" = "$version"

RUN pnpm install --frozen-lockfile
RUN pnpm run build:official
RUN pnpm run release:pack --family dsh --out /packed/dsh \
 && pnpm run release:pack --family vendor --out /packed/vendor \
 && pnpm --dir native/system run build:ts \
 && pnpm --dir native/system/packages/entry pack --pack-destination /packed/landlock

# ---- install: musl node_modules from the tarballs ----
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS install

# Toolchain only here, for native addons without musl prebuilds.
RUN apk add --no-cache python3 make g++

COPY --from=build /packed /packed
COPY --from=dist manifest.mjs rebrand-web.mjs /opt/tools/
COPY packages/client/ui-brand-official/src/client/assets/for-easy-life-symbol.png /opt/tools/brand.png

RUN mkdir -p /opt/zerix \
 && node /opt/tools/manifest.mjs /opt/zerix /packed/dsh /packed/vendor /packed/landlock \
 && cd /opt/zerix \
 && npm install --omit=dev --no-audit --no-fund --package-lock=false \
 && node /opt/tools/rebrand-web.mjs /opt/zerix /opt/tools/brand.png \
 && npm cache clean --force \
 && rm -rf /root/.npm /root/.cache /tmp/*

# ---- runtime ----
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

ARG PLATFORM_ORIGIN
ARG INFERENCE_ORIGIN
ARG ZERIX_VERSION
RUN case "$PLATFORM_ORIGIN" in https://?*) ;; *) echo "PLATFORM_ORIGIN must be https://..." >&2; exit 1 ;; esac \
 && case "$INFERENCE_ORIGIN" in https://?*) ;; *) echo "INFERENCE_ORIGIN must be https://..." >&2; exit 1 ;; esac

# bash: the agent's shell tool runs `bash -c`. tini: PID 1 signal/zombie handling.
RUN apk add --no-cache bash tini

# The default workspace asks `xdg-user-dir DOCUMENTS`.
RUN <<'END_RUN'
cat > /usr/local/bin/xdg-user-dir <<'SH'
#!/bin/sh
echo "${XDG_DOCUMENTS_DIR:-$HOME/Documents}"
SH
chmod 0755 /usr/local/bin/xdg-user-dir
END_RUN
COPY --from=dist --chmod=0755 entrypoint.sh /usr/local/bin/zerix-entrypoint

COPY --from=install --chown=node:node /opt/zerix /opt/zerix
RUN mkdir -p /data && chown node:node /data

ENV DSH_HOME=/data/zerix \
    HOME=/data \
    XDG_DOCUMENTS_DIR=/data/Documents \
    PATH=/opt/zerix/node_modules/.bin:$PATH \
    NODE_ENV=production \
    ZERIX_PORT=4719 \
    DSH_PLATFORM_ORIGIN=${PLATFORM_ORIGIN} \
    DSH_INFERENCE_ORIGIN=${INFERENCE_ORIGIN}

LABEL org.opencontainers.image.source="https://github.com/albasyir-group/zerix-desktop-dist" \
      org.opencontainers.image.title="Zerix" \
      org.opencontainers.image.description="Zerix web (For Easy Life)" \
      org.opencontainers.image.version="${ZERIX_VERSION}"

VOLUME /data
EXPOSE 4719
USER node
WORKDIR /data
# No HEALTHCHECK: the server answers 401 without its token.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/zerix-entrypoint"]
