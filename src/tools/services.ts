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
    'railway_services_list',
    {
      title: 'List Services',
      description: 'List all services in a project.',
      inputSchema: {
        projectId: z.string().min(1, 'Project ID is required').describe('The ID of the project.'),
        first: z
          .number()
          .int()
          .positive()
          .max(100)
          .describe('Maximum number of items to return.')
          .optional(),
        last: z
          .number()
          .int()
          .positive()
          .max(100)
          .describe('Fetch items in reverse order (use with before).')
          .optional(),
        after: z.string().describe('Cursor for the next page.').optional(),
        before: z.string().describe('Cursor for the previous page.').optional(),
      },
      outputSchema: {
        services: z.object({
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                name: z.string(),
                icon: z.string().nullable(),
                createdAt: z.string(),
                updatedAt: z.string(),
                deletedAt: z.string().nullable(),
                projectId: z.string(),
              }),
            }),
          ),
          pageInfo: z.object({
            hasNextPage: z.boolean(),
            hasPreviousPage: z.boolean(),
            startCursor: z.string().nullable(),
            endCursor: z.string().nullable(),
          }),
        }),
      },
    },
    async ({ projectId, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      try {
        const railway = getRailway();
        const data = await railway.services.list({
          variables: {
            projectId,
            first: first ?? null,
            after: after ?? null,
            last: last ?? null,
            before: before ?? null,
          },
        });

        return successResponse({ services: data.project.services });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

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
