# syntax=docker/dockerfile:1.7

# Build the railway-mcp-server from this fork's src/ rather than pulling the
# pre-built npm package. Building locally keeps the exposed tool surface to
# exactly what src/tools/*.ts registers, and lets us ship src/http.ts -- the
# in-process Express + Auth0 OAuth front door that serves /mcp (see that file).
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY bun.lock ./
# --ignore-scripts skips the `prepare` lifecycle hook (`node .husky/install.mjs`),
# which would fail here because .husky/ isn't copied into the Docker context
# and isn't relevant in a container build anyway -- husky only wires up local
# git hooks. None of the runtime deps need install-time scripts.
RUN npm install --include=dev --ignore-scripts

COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN npm run build && chmod +x dist/index.js

# --- Runner ---
FROM node:20-alpine

# tini as PID 1 for correct signal forwarding (SIGTERM on redeploy) and to reap
# any short-lived child processes the railway SDK might spawn.
RUN apk add --no-cache tini

WORKDIR /app

# Bring over the built server plus runtime node_modules so dist/http.js can
# resolve @modelcontextprotocol/sdk, express, jose and @crisog/railway-sdk at
# runtime.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
