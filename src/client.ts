import {
  GraphQLRequestError,
  MissingTokenError,
  createRailway,
  requireTokenFromEnv,
  type EnvToken,
  type Railway,
} from '@crisog/railway-sdk';

let cachedRailway: Railway | null = null;
let cachedEnvToken: EnvToken | null = null;

export const getEnvToken = (): EnvToken => {
  if (cachedEnvToken) {
    return cachedEnvToken;
  }

  cachedEnvToken = requireTokenFromEnv();
  return cachedEnvToken;
};

export const getRailway = (): Railway => {
  if (cachedRailway) {
    return cachedRailway;
  }

  const envToken = getEnvToken();

  cachedRailway = createRailway({
    token: envToken.token,
    tokenType: envToken.type,
  });

  return cachedRailway;
};

export const getRailwayClient = (): Railway['client'] => {
  const railway = getRailway();
  return railway.client;
};

export const toRailwayErrorMessage = (error: unknown): string => {
  if (error instanceof MissingTokenError) {
    return error.message;
  }

  if (error instanceof GraphQLRequestError) {
    let message = `Railway request failed: ${error.message}`;

    // Railway answers "Not Authorized" both for resources outside the token's
    // reach and for user-level queries a workspace token may not make, which
    // otherwise reads like a broken token.
    if (/not authorized/i.test(error.message)) {
      message +=
        '\nHint: this token cannot reach that resource. An account token only sees workspaces ' +
        'its user belongs to; a workspace token only sees its own workspace and cannot call ' +
        'user-level APIs (e.g. GitHub repo listing). Check which Railway account/workspace ' +
        'owns the resource and use a token from it.';
    }

    if (error.rawBody) {
      const preview =
        error.rawBody.length > 200 ? `${error.rawBody.substring(0, 200)}...` : error.rawBody;
      return `${message}\nResponse body: ${preview}`;
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred while talking to Railway.';
};
