# syntax=docker/dockerfile:1.7

# Build the railway-mcp-server from this fork's src/ rather than pulling the
# pre-built npm package. The npm-published binary advertises tools (notably
# railway_verify_connection) that aren't in this fork's source. Those tools
# always fail with Workspace-scope tokens, which fools Claude sessions into
# concluding the connector is broken when it isn't. Building locally keeps
# the exposed tool surface to exactly what src/tools/*.ts registers.
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

# tini reaps zombie stdio children that supergateway forks per session.
# Without it, every Claude reconnect leaks a defunct node process.
RUN apk add --no-cache tini

WORKDIR /app

# Bring over the built MCP plus runtime node_modules so dist/index.js can
# resolve @modelcontextprotocol/sdk and @crisog/railway-sdk at runtime.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# supergateway stays pinned at v3 (the version where stdio->streamableHttp
# multi-session handling actually works). Installed globally so it's on PATH.
# --ignore-scripts here too, for the same reason as the builder stage.
ARG SUPERGATEWAY_VERSION=3
RUN npm install -g --ignore-scripts "supergateway@${SUPERGATEWAY_VERSION}"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
