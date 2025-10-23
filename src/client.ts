import {
  GraphQLRequestError,
  MissingTokenError,
  RailwayClient,
  requireTokenFromEnv,
  type EnvToken,
} from 'railway-sdk';

let cachedClient: RailwayClient | null = null;
let cachedEnvToken: EnvToken | null = null;

export const getEnvToken = (): EnvToken => {
  if (cachedEnvToken) {
    return cachedEnvToken;
  }

  cachedEnvToken = requireTokenFromEnv();
  return cachedEnvToken;
};

export const getRailwayClient = (): RailwayClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const envToken = getEnvToken();

  cachedClient = new RailwayClient({
    token: envToken.token,
    tokenType: envToken.type,
  });

  return cachedClient;
};

export const toRailwayErrorMessage = (error: unknown): string => {
  if (error instanceof MissingTokenError) {
    return error.message;
  }

  if (error instanceof GraphQLRequestError) {
    return `Railway request failed: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred while talking to Railway.';
};
