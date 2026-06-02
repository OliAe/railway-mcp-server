#!/usr/bin/env node

/**
 * Remote HTTP entrypoint for the Railway MCP server.
 *
 * This replaces the old `supergateway` wrapper. Instead of forking a stdio
 * child and bridging it to HTTP, we run the MCP server in-process behind an
 * Express app and (optionally) require an Auth0-backed OAuth login before any
 * `/mcp` request is served.
 *
 * Why this exists: the previous deployment exposed `/mcp` with `--cors` and no
 * auth, so anyone who found the URL could drive the whole Railway account via
 * the baked-in RAILWAY_API_TOKEN. With OAUTH_ENABLED=true the server advertises
 * OAuth 2.1 discovery, proxies /authorize + /token to Auth0, and verifies the
 * resulting JWT against Auth0's JWKS on every call.
 *
 * The stdio entrypoint (src/index.ts) is unchanged and still used for local /
 * npx usage.
 */

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

import { createServer } from './server.js';
import { getEnvToken } from './client.js';

// ---------------------------------------------------------------------------
// Configuration (all from env)
// ---------------------------------------------------------------------------

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const MCP_PATH = '/mcp';

const resolvePublicUrl = (): string => {
  // Explicit override wins.
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/+$/, '');
  }
  // Railway injects the public domain once a domain is generated.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Local dev fallback. The SDK allows non-HTTPS issuer URLs only for localhost.
  return `http://localhost:${PORT}`;
};

const PUBLIC_URL = resolvePublicUrl();
const OAUTH_ENABLED = process.env.OAUTH_ENABLED === 'true';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? '';
// If AUTH0_AUDIENCE is set, tokens must be minted for (and verified against)
// this API identifier. It is also injected as the `audience` on the upstream
// /authorize call so Auth0 returns a verifiable JWT instead of an opaque token.
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? '';

// Claude's OAuth callback URLs. Hard-coded because the SDK validates the
// incoming redirect_uri against the client's registered list before it will
// proxy /authorize upstream. These are the well-known Claude.ai / Claude
// desktop callbacks.
const CLAUDE_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'http://localhost/callback',
  'http://127.0.0.1/callback',
];

// Scopes Claude may request. `offline_access` yields a refresh token.
const SUPPORTED_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const CLIENT_SCOPE = SUPPORTED_SCOPES.join(' ');

// Optional allow-list of Auth0 client IDs permitted to drive the login flow.
// Defense in depth on top of Auth0's own client validation. Leave unset to
// accept any client_id Auth0 recognises.
const ALLOWED_CLIENT_IDS = (process.env.OAUTH_ALLOWED_CLIENT_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// Optional DNS-rebinding protection for the streamable transport. When unset,
// protection is disabled (the Bearer JWT is the real access control).
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Auth0 OAuth proxy
// ---------------------------------------------------------------------------

/**
 * `ProxyOAuthServerProvider` forwards the standard OAuth params to the upstream
 * /authorize endpoint but never sends Auth0's `audience` parameter. Without it
 * Auth0 issues an *opaque* access token, which cannot be verified against the
 * JWKS. Overriding `authorize()` lets us inject `audience` so Auth0 mints a JWT
 * for our API identifier (and `offline_access` yields a refresh token).
 */
class Auth0ProxyProvider extends ProxyOAuthServerProvider {
  readonly #authorizationUrl: string;
  readonly #audience: string;

  constructor(args: {
    authorizationUrl: string;
    tokenUrl: string;
    revocationUrl?: string;
    audience: string;
    verifyAccessToken: (token: string) => Promise<AuthInfo>;
    getClient: (clientId: string) => Promise<OAuthClientInformationFull | undefined>;
  }) {
    super({
      endpoints: {
        authorizationUrl: args.authorizationUrl,
        tokenUrl: args.tokenUrl,
        revocationUrl: args.revocationUrl,
      },
      verifyAccessToken: args.verifyAccessToken,
      getClient: args.getClient,
    });
    this.#authorizationUrl = args.authorizationUrl;
    this.#audience = args.audience;
  }

  override async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const target = new URL(this.#authorizationUrl);
    const search = new URLSearchParams({
      client_id: client.client_id,
      response_type: 'code',
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    });
    if (params.state) {
      search.set('state', params.state);
    }
    if (params.scopes?.length) {
      search.set('scope', params.scopes.join(' '));
    }
    if (this.#audience) {
      // The bit ProxyOAuthServerProvider omits — required for a JWT from Auth0.
      search.set('audience', this.#audience);
    }
    target.search = search.toString();
    res.redirect(target.toString());
  }
}

const buildVerifier = (): ((token: string) => Promise<AuthInfo>) => {
  const issuer = `https://${AUTH0_DOMAIN}/`;
  const jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));

  return async (token: string): Promise<AuthInfo> => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: AUTH0_AUDIENCE || undefined,
      });

      const scope = typeof payload.scope === 'string' ? payload.scope : '';
      const audience = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
      const claims = payload as Record<string, unknown>;
      const clientId =
        (typeof claims.azp === 'string' && claims.azp) ||
        (typeof claims.client_id === 'string' && claims.client_id) ||
        (typeof audience === 'string' && audience) ||
        'unknown';

      return {
        token,
        clientId,
        scopes: scope ? scope.split(' ') : [],
        expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
        extra: typeof payload.sub === 'string' ? { sub: payload.sub } : undefined,
      };
    } catch (error) {
      // requireBearerAuth only emits a spec-compliant 401 + WWW-Authenticate for
      // InvalidTokenError. Any other thrown type becomes a 500, and Claude never
      // learns where to log in. Normalise every failure to InvalidTokenError.
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Token verification failed';
      throw new InvalidTokenError(message);
    }
  };
};

const getClient = async (clientId: string): Promise<OAuthClientInformationFull | undefined> => {
  if (ALLOWED_CLIENT_IDS.length > 0 && !ALLOWED_CLIENT_IDS.includes(clientId)) {
    return undefined;
  }
  return {
    client_id: clientId,
    redirect_uris: CLAUDE_REDIRECT_URIS,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: CLIENT_SCOPE,
  };
};

// ---------------------------------------------------------------------------
// MCP streamable-HTTP transport (one server + transport per session)
// ---------------------------------------------------------------------------

const transports = new Map<string, StreamableHTTPServerTransport>();

const headerValue = (raw: string | string[] | undefined): string | undefined =>
  Array.isArray(raw) ? raw[0] : raw;

const createTransport = (): StreamableHTTPServerTransport => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      transports.set(sessionId, transport);
    },
    ...(ALLOWED_HOSTS.length > 0
      ? { enableDnsRebindingProtection: true, allowedHosts: ALLOWED_HOSTS }
      : {}),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
  };

  return transport;
};

const handleMcpPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = headerValue(req.headers['mcp-session-id']);
    const existing = sessionId ? transports.get(sessionId) : undefined;

    let transport: StreamableHTTPServerTransport;
    if (existing) {
      transport = existing;
    } else if (sessionId) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return;
    } else if (isInitializeRequest(req.body)) {
      // Fresh session: stand up a new server bound to a new transport.
      transport = createTransport();
      await createServer().connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: no valid session ID provided' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP POST:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
};

const handleMcpSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = headerValue(req.headers['mcp-session-id']);
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP session request:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

// ---------------------------------------------------------------------------
// App wiring
// ---------------------------------------------------------------------------

const buildApp = (): express.Express => {
  const app = express();
  app.disable('x-powered-by');

  // Browser-based MCP clients (claude.ai) call /mcp and the discovery endpoints
  // via fetch, so CORS must allow any origin and expose the session header.
  app.use(
    cors({
      origin: true,
      exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Mcp-Session-Id',
        'mcp-protocol-version',
        'Last-Event-ID',
      ],
    }),
  );

  // Railway health-check — must stay unauthenticated.
  app.get('/health', (_req, res) => {
    res.status(200).send('ok');
  });

  if (OAUTH_ENABLED) {
    if (!AUTH0_DOMAIN) {
      throw new Error(
        'OAUTH_ENABLED=true but AUTH0_DOMAIN is not set. Set AUTH0_DOMAIN (and ' +
          'AUTH0_AUDIENCE) or unset OAUTH_ENABLED.',
      );
    }

    const verifyAccessToken = buildVerifier();
    const provider = new Auth0ProxyProvider({
      authorizationUrl: `https://${AUTH0_DOMAIN}/authorize`,
      tokenUrl: `https://${AUTH0_DOMAIN}/oauth/token`,
      revocationUrl: `https://${AUTH0_DOMAIN}/oauth/revoke`,
      audience: AUTH0_AUDIENCE,
      verifyAccessToken,
      getClient,
    });

    // Mounts /authorize, /token, /revoke and the discovery documents:
    //   /.well-known/oauth-authorization-server
    //   /.well-known/oauth-protected-resource/mcp
    // No registrationUrl is configured, so Dynamic Client Registration is
    // intentionally disabled. Clients paste a pre-created static Client ID under
    // Claude's "Advanced settings" instead — this sidesteps the Auth0 dev-tenant
    // app cap that breaks new DCR users.
    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl: new URL(PUBLIC_URL),
        baseUrl: new URL(PUBLIC_URL),
        resourceServerUrl: new URL(`${PUBLIC_URL}${MCP_PATH}`),
        scopesSupported: SUPPORTED_SCOPES,
        resourceName: 'Railway MCP Server',
      }),
    );

    // Require a valid Auth0 JWT on every /mcp request. On failure this returns
    // 401 with a WWW-Authenticate header pointing at the protected-resource
    // metadata, which is what triggers Claude's login flow.
    app.use(
      MCP_PATH,
      requireBearerAuth({
        verifier: { verifyAccessToken },
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
          new URL(`${PUBLIC_URL}${MCP_PATH}`),
        ),
      }),
    );
  } else {
    console.error(
      'WARNING: OAUTH_ENABLED is not "true" — /mcp is UNAUTHENTICATED. Anyone who ' +
        'can reach this URL can drive your Railway account. Set OAUTH_ENABLED=true ' +
        'with AUTH0_DOMAIN and AUTH0_AUDIENCE to require login.',
    );
  }

  app.post(MCP_PATH, express.json({ limit: '10mb' }), (req, res) => {
    void handleMcpPost(req, res);
  });
  app.get(MCP_PATH, (req, res) => {
    void handleMcpSession(req, res);
  });
  app.delete(MCP_PATH, (req, res) => {
    void handleMcpSession(req, res);
  });

  return app;
};

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const main = async (): Promise<void> => {
  // Fail fast and loud if the Railway token is missing — same rationale as the
  // old entrypoint.sh. Otherwise the server boots and every tool call later
  // fails with an opaque "missing token" error.
  try {
    getEnvToken();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Set RAILWAY_API_TOKEN in the Railway service variables, then redeploy.');
    process.exit(1);
  }

  const app = buildApp();

  const server: Server = app.listen(PORT, () => {
    console.error(`railway-mcp-server (HTTP) listening on :${PORT}`);
    console.error(`  MCP endpoint: ${PUBLIC_URL}${MCP_PATH}`);
    console.error(
      `  OAuth:        ${OAUTH_ENABLED ? `enabled (Auth0 ${AUTH0_DOMAIN}, audience ${AUTH0_AUDIENCE || '(none)'})` : 'DISABLED'}`,
    );
  });

  const shutdown = (signal: string): void => {
    console.error(`Received ${signal}, shutting down.`);
    for (const transport of transports.values()) {
      void transport.close();
    }
    server.close(() => process.exit(0));
    // Force exit if connections linger past a grace period.
    setTimeout(() => process.exit(0), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

await main();
