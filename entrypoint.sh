#!/bin/sh
set -e

# Fail fast and loud if RAILWAY_API_TOKEN is missing. Without this the stdio
# child boots fine, then every tool call errors with "missing token" while
# Claude.ai surfaces only a generic connection failure. Crashing here puts
# the real cause in Railway's deploy log instead.
if [ -z "${RAILWAY_API_TOKEN:-}" ]; then
  echo "FATAL: RAILWAY_API_TOKEN env var is not set." >&2
  echo "Set it in Railway -> service -> Variables, then redeploy." >&2
  exit 1
fi

PORT="${PORT:-8080}"

# Build the public base URL only when Railway has provisioned a public domain.
# On the very first deploy (before clicking Settings -> Networking -> Generate
# Domain), RAILWAY_PUBLIC_DOMAIN is empty and "--baseUrl https://" is invalid,
# crashing supergateway on startup. Falling back to a loopback URL lets the
# container boot far enough to serve /health so Railway's healthcheck passes.
if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  BASE_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
else
  BASE_URL="http://localhost:${PORT}"
  echo "WARN: RAILWAY_PUBLIC_DOMAIN is unset; using ${BASE_URL}." >&2
  echo "Generate a public domain in Railway -> Settings -> Networking, then redeploy." >&2
fi

echo "Starting supergateway on :${PORT} (baseUrl=${BASE_URL})"

# Use streamableHttp instead of SSE. supergateway v3's stdioToSse gateway
# reuses a single McpServer across SSE connections and throws "Already
# connected to a transport" on the second connect (Claude.ai's probe-then-use
# flow trips this every time). The streamableHttp gateway handles session
# reconnects via the Mcp-Session-Id header on a single POST /mcp endpoint
# and does not have this bug.
#
# exec so SIGTERM from Railway reaches supergateway directly; without exec
# the parent /bin/sh swallows the signal, dropping in-flight requests on
# every redeploy.
exec supergateway \
  --stdio 'railway-mcp-server' \
  --port "${PORT}" \
  --baseUrl "${BASE_URL}" \
  --outputTransport streamableHttp \
  --healthEndpoint "/health" \
  --cors
