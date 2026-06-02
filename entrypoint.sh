#!/bin/sh
set -e

# Fail fast and loud if RAILWAY_API_TOKEN is missing. Without this the server
# boots fine, then every tool call errors with "missing token" while Claude.ai
# surfaces only a generic connection failure. Crashing here puts the real cause
# in Railway's deploy log instead. (src/http.ts re-checks this too.)
if [ -z "${RAILWAY_API_TOKEN:-}" ]; then
  echo "FATAL: RAILWAY_API_TOKEN env var is not set." >&2
  echo "Set it in Railway -> service -> Variables, then redeploy." >&2
  exit 1
fi

# When OAuth is enabled, the server proxies login to Auth0 and verifies the
# returned JWT. Surface a misconfiguration early rather than 500-ing on first
# request.
if [ "${OAUTH_ENABLED:-}" = "true" ] && [ -z "${AUTH0_DOMAIN:-}" ]; then
  echo "FATAL: OAUTH_ENABLED=true but AUTH0_DOMAIN is not set." >&2
  echo "Set AUTH0_DOMAIN (and AUTH0_AUDIENCE) in Railway -> Variables, then redeploy." >&2
  exit 1
fi

if [ -z "${RAILWAY_PUBLIC_DOMAIN:-}" ] && [ -z "${PUBLIC_URL:-}" ]; then
  echo "WARN: neither RAILWAY_PUBLIC_DOMAIN nor PUBLIC_URL is set; OAuth discovery" >&2
  echo "      URLs will point at localhost. Generate a public domain in Railway ->" >&2
  echo "      Settings -> Networking (or set PUBLIC_URL), then redeploy." >&2
fi

echo "Starting railway-mcp-server (HTTP) on :${PORT:-8080}"

# exec so SIGTERM from Railway reaches node directly; without exec the parent
# /bin/sh swallows the signal and in-flight requests are dropped on redeploy.
exec node /app/dist/http.js
