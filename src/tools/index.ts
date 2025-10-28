import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getEnvToken, getRailway, toRailwayErrorMessage } from '../client.js';
import { registerDeploymentTools } from './deployments.js';
import { registerProjectTools } from './projects.js';
import { registerServiceTools } from './services.js';
import { registerVariableTools } from './variables.js';
import { errorResponse, successResponse } from './responses.js';

export const registerTools = (server: McpServer): void => {
  registerVerifyConnectionTool(server);
  registerProjectTools(server);
  registerServiceTools(server);
  registerDeploymentTools(server);
  registerVariableTools(server);
};

const registerVerifyConnectionTool = (server: McpServer): void => {
  server.registerTool(
    'railway_verify_connection',
    {
      title: 'Verify Railway Connection',
      description: 'Checks that the Railway SDK can authenticate using environment tokens.',
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
      },
    },
    async () => {
      try {
        const envToken = getEnvToken();
        getRailway();

        const message = `Successfully initialised Railway client using ${envToken.type} token from ${envToken.envVar}.`;

        return successResponse({
          success: true,
          message,
        });
      } catch (error) {
        const message = toRailwayErrorMessage(error);

        return errorResponse(message);
      }
    },
  );
};
