import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const serviceIdSchema = z
  .string()
  .min(1, 'Service ID is required')
  .describe('The ID of the service.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The ID of the environment.');

export const registerServiceTools = (server: McpServer): void => {
  server.registerTool(
    'railway_service_get',
    {
      title: 'Get Service',
      description: 'Retrieve details about a specific service.',
      inputSchema: {
        serviceId: serviceIdSchema,
      },
      outputSchema: {
        service: z
          .object({
            id: z.string(),
            name: z.string(),
            projectId: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ serviceId }) => {
      try {
        const railway = getRailway();
        const data = await railway.services.get({
          variables: {
            id: serviceId,
          },
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_service_update',
    {
      title: 'Update Service',
      description: "Update a service's metadata such as name or icon.",
      inputSchema: {
        serviceId: serviceIdSchema,
        name: z.string().trim().min(1).describe('New service name.').optional(),
        icon: z.string().trim().min(1).describe('Icon URL for the service.').optional(),
      },
      outputSchema: {
        service: z
          .object({
            id: z.string(),
            name: z.string(),
            icon: z.string().nullable(),
          })
          .passthrough(),
      },
    },
    async ({ serviceId, name, icon }) => {
      if (!name && !icon) {
        return errorResponse('Provide at least one field to update.');
      }

      try {
        const railway = getRailway();
        const result = await railway.services.update({
          variables: {
            id: serviceId,
            input: {
              name: name ?? null,
              icon: icon ?? null,
            },
          },
        });

        return successResponse({ service: result.serviceUpdate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_service_deploy_latest',
    {
      title: 'Deploy Service (Latest Commit)',
      description:
        'Trigger a deployment for a service instance using the latest code or a specific commit.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        commitSha: z.string().trim().min(7).describe('Optional commit SHA to deploy.').optional(),
      },
      outputSchema: {
        deploymentId: z.string(),
      },
    },
    async ({ serviceId, environmentId, commitSha }) => {
      try {
        const railway = getRailway();
        const result = await railway.services.instances.deployV2({
          variables: {
            serviceId,
            environmentId,
            commitSha: commitSha ?? null,
          },
        });

        return successResponse({ deploymentId: result.serviceInstanceDeployV2 });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
