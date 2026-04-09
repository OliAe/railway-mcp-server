FROM node:20-slim

WORKDIR /app

RUN npm install -g @crisog/railway-mcp-server supergateway

EXPOSE ${PORT:-8080}

CMD ["sh", "-c", "supergateway --stdio 'railway-mcp-server' --port ${PORT:-8080} --baseUrl https://${RAILWAY_PUBLIC_DOMAIN}"]
