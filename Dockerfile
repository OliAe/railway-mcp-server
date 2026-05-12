FROM node:20-alpine

# tini reaps zombie children. supergateway spawns a fresh stdio
# `railway-mcp-server` process per SSE session; without an init process,
# defunct children pile up after every Claude.ai reconnect until the
# container hits the PID limit or OOMs.
RUN apk add --no-cache tini

WORKDIR /app

# Pin upstream versions so a surprise breaking release on npm can't take
# the deploy down. Bump these by hand when you want a newer version.
ARG RAILWAY_MCP_VERSION=0.0.2
ARG SUPERGATEWAY_VERSION=3
RUN npm install -g \
      "@crisog/railway-mcp-server@${RAILWAY_MCP_VERSION}" \
      "supergateway@${SUPERGATEWAY_VERSION}"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
