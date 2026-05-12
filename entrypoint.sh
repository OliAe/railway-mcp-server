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

# Run the locally-built MCP via node, not the global railway-mcp-server
# binary. Local build registers only the tools defined in src/tools/*.ts
# (no railway_verify_connection), so Claude sessions can't be misled by
# its perpetual "Not Authorized" response.
#
# streamableHttp instead of sse: supergateway v3's stdioToSse gateway reuses
# a single McpServer across SSE connects and throws "Already connected to a
# transport" on Claude.ai's normal probe-then-use flow. streamableHttp uses
# a different gateway that handles session reconnects via the
# Mcp-Session-Id header on POST /mcp and does not have this bug.
#
# exec so SIGTERM from Railway reaches supergateway directly; without exec
# the parent /bin/sh swallows the signal, dropping in-flight requests on
# every redeploy.
exec supergateway \
  --stdio 'node /app/dist/index.js' \
  --port "${PORT}" \
  --baseUrl "${BASE_URL}" \
  --outputTransport streamableHttp \
  --healthEndpoint "/health" \
  --cors
