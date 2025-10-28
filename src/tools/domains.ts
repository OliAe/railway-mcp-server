import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const serviceIdSchema = z
  .string()
  .min(1, 'Service ID is required')
  .describe('The ID of the service to attach the domain to.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The environment where the domain will be generated.');

export const registerDomainTools = (server: McpServer): void => {
  server.registerTool(
    'railway_domain_generate',
    {
      title: 'Generate Service Domain',
      description: 'Generate a default railway.app domain for a service within an environment.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        targetPort: z
          .number()
          .int()
          .positive()
          .describe('Optional target port to route traffic to.')
          .optional(),
      },
      outputSchema: {
        domain: z.object({
          id: z.string(),
          domain: z.string(),
          projectId: z.string().nullable(),
          serviceId: z.string(),
          environmentId: z.string(),
          suffix: z.string().nullable(),
          targetPort: z.number().int().nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
          deletedAt: z.string().nullable(),
        }),
      },
    },
    async ({ serviceId, environmentId, targetPort }) => {
      try {
        const railway = getRailway();
        const result = await railway.services.domains.create({
          variables: {
            input: {
              serviceId,
              environmentId,
              targetPort: targetPort ?? null,
            },
          },
        });

        return successResponse({ domain: result.serviceDomainCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
