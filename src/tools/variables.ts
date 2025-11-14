import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapField } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The project ID.');

const environmentIdSchema = z
  .string()
  .uuid('Environment ID must be a valid UUID')
  .describe('The environment ID.');

const serviceIdSchema = z
  .string()
  .uuid('Service ID must be a valid UUID')
  .describe('The service ID.');

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
      const railway = getRailway();
      const result = await railway.variables.serviceDeployment.variables({
        variables: {
          projectId,
          environmentId,
          serviceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const variablesResult = unwrapField(
        result,
        'variablesForServiceDeployment',
        'Invalid response from Railway: variables not found.',
      );
      if (variablesResult.isErr()) {
        return errorResponse(variablesResult.error.message);
      }

      return successResponse({ variables: variablesResult.value });
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
      const railway = getRailway();
      const result = await railway.variables.upsert({
        variables: {
          input: {
            projectId,
            environmentId,
            name,
            value,
            serviceId,
            skipDeploys,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      return successResponse({ success: result.value.variableUpsert ?? false });
    },
  );

  server.registerTool(
    'railway_variables_collection_upsert',
    {
      title: 'Bulk Upsert Variables',
      description: 'Create or update multiple variables at once.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        variables: z.record(z.string(), z.string()).describe('Key-value pairs of variables.'),
        serviceId: serviceIdSchema.optional(),
        replace: z
          .boolean()
          .optional()
          .describe('If true, removes all existing variables before upserting.'),
        skipDeploys: z
          .boolean()
          .optional()
          .describe('Skip automatic redeployments that would be triggered by this change.'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    async ({ projectId, environmentId, variables, serviceId, replace, skipDeploys }) => {
      const railway = getRailway();
      const result = await railway.variables.collectionUpsert({
        variables: {
          input: {
            projectId,
            environmentId,
            variables,
            serviceId,
            replace,
            skipDeploys,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      return successResponse({ success: result.value.variableCollectionUpsert ?? false });
    },
  );
};
