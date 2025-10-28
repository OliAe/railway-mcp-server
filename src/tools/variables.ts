import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z.string().min(1, 'Project ID is required').describe('The project ID.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The environment ID.');

const serviceIdSchema = z.string().min(1, 'Service ID is required').describe('The service ID.');

export const registerVariableTools = (server: McpServer): void => {
  server.registerTool(
    'railway_variables_render_for_deployment',
    {
      title: 'Render Deployment Variables',
      description: 'Resolve the concrete variables that will be present for a service deployment.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        serviceId: serviceIdSchema,
      },
      outputSchema: {
        variables: z.record(z.string(), z.any()),
      },
    },
    async ({ projectId, environmentId, serviceId }) => {
      try {
        const railway = getRailway();
        const result = await railway.variables.serviceDeployment.variables({
          variables: {
            projectId,
            environmentId,
            serviceId,
          },
        });

        return successResponse({
          variables: result.variablesForServiceDeployment,
        });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_variable_upsert',
    {
      title: 'Upsert Variable',
      description: 'Create or update a variable at the project or service scope.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        name: z.string().min(1, 'Variable name is required').describe('Name of the variable.'),
        value: z.string().describe('Value to store for the variable.'),
        serviceId: serviceIdSchema.optional(),
        skipDeploys: z
          .boolean()
          .optional()
          .describe('Skip automatic redeployments that would be triggered by this change.'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    async ({ projectId, environmentId, name, value, serviceId, skipDeploys }) => {
      try {
        const railway = getRailway();
        const result = await railway.variables.upsert({
          variables: {
            input: {
              projectId,
              environmentId,
              name,
              value,
              serviceId: serviceId ?? null,
              skipDeploys: skipDeploys ?? null,
            },
          },
        });

        return successResponse({ success: result.variableUpsert });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
