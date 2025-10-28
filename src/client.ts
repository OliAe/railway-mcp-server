import {
  GraphQLRequestError,
  MissingTokenError,
  createRailway,
  requireTokenFromEnv,
  type EnvToken,
  type Railway,
} from 'railway-sdk';

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
    return `Railway request failed: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred while talking to Railway.';
};
