#!/bin/sh
set -eu

# The web server refuses wildcard binds (0.0.0.0 / ::) by design, so it binds
# the container's own interface IP. The public URL is localhost because users
# publish the port with `-p 127.0.0.1:4719:4719`.
port="${ZERIX_PORT:-4719}"
host="${ZERIX_BIND:-$(hostname -i | awk '{print $1}')}"
public="${ZERIX_PUBLIC_URL:-http://localhost:${port}/}"

mkdir -p "$DSH_HOME" "$XDG_DOCUMENTS_DIR"

exec zerix web --no-open --host "$host" --port "$port" --public-url "$public" \
  --trusted-host "localhost:${port}" --trusted-host "127.0.0.1:${port}" "$@"
