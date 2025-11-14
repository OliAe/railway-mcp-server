import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField, unwrapArray } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project that will own the environment.');

const environmentNameSchema = z
  .string()
  .trim()
  .min(1, 'Environment name is required')
  .describe('Human-readable name for the new environment.');

const environmentIdSchema = z
  .string()
  .uuid(
    'Environment ID must be a valid UUID. Use railway_environments_list to get the correct environment ID.',
  )
  .describe(
    'The ID (UUID) of the environment. Use railway_environments_list to find available environments.',
  );

export const registerEnvironmentTools = (server: McpServer): void => {
  server.registerTool(
    'railway_environments_list',
    {
      title: 'List Environments',
      description: 'List all environments for a project.',
      inputSchema: {
        projectId: projectIdSchema,
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
        environments: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string(),
            projectId: z.string(),
            isEphemeral: z.boolean(),
            createdAt: z.string(),
            updatedAt: z.string(),
            deletedAt: z.string().nullable(),
            unmergedChangesCount: z.number().int().nullable(),
          }),
        ),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          hasPreviousPage: z.boolean(),
          startCursor: z.string().nullable(),
          endCursor: z.string().nullable(),
        }),
      },
    },
    async ({ projectId, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.environments.list({
        variables: {
          projectId,
          first,
          after,
          last,
          before,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const environmentsResult = unwrapField(
        result,
        'environments',
        'Invalid response from Railway: environments not found.',
      );
      if (environmentsResult.isErr()) {
        return errorResponse(environmentsResult.error.message);
      }

      return successResponse({ environments: environmentsResult.value });
    },
  );

  server.registerTool(
    'railway_environment_create',
    {
      title: 'Create Environment',
      description:
        'Create a new environment for a project. Optionally clone configuration from an existing environment.',
      inputSchema: {
        projectId: projectIdSchema,
        name: environmentNameSchema,
        sourceEnvironmentId: z
          .string()
          .trim()
          .uuid('Source environment ID must be a valid UUID')
          .describe('Environment ID to copy configuration from.')
          .optional(),
        ephemeral: z
          .boolean()
          .describe('Mark the environment as ephemeral (auto-deletes after inactivity).')
          .optional(),
        stageInitialChanges: z
          .boolean()
          .describe(
            'If true, keep the initial environment changes staged instead of committing immediately.',
          )
          .optional(),
        applyChangesInBackground: z
          .boolean()
          .describe('Apply environment creation changes asynchronously.')
          .optional(),
        skipInitialDeploys: z
          .boolean()
          .describe('Skip automatic deploys triggered by cloning an environment.')
          .optional(),
      },
      outputSchema: {
        environment: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          isEphemeral: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deletedAt: z.string().nullable(),
          unmergedChangesCount: z.number().int().nullable(),
        }),
      },
    },
    async ({
      projectId,
      name,
      sourceEnvironmentId,
      ephemeral,
      stageInitialChanges,
      applyChangesInBackground,
      skipInitialDeploys,
    }) => {
      const railway = getRailway();
      const result = await railway.environments.create({
        variables: {
          input: {
            projectId,
            name,
            sourceEnvironmentId,
            ephemeral,
            stageInitialChanges,
            applyChangesInBackground,
            skipInitialDeploys,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const environmentResult = unwrapField(
        result,
        'environmentCreate',
        'Failed to create environment.',
      );
      if (environmentResult.isErr()) {
        return errorResponse(environmentResult.error.message);
      }

      return successResponse({ environment: environmentResult.value });
    },
  );

  server.registerTool(
    'railway_environment_rename',
    {
      title: 'Rename Environment',
      description: 'Rename an environment.',
      inputSchema: {
        environmentId: environmentIdSchema,
        name: environmentNameSchema,
      },
      outputSchema: {
        environment: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          isEphemeral: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deletedAt: z.string().nullable(),
          unmergedChangesCount: z.number().int().nullable(),
        }),
      },
    },
    async ({ environmentId, name }) => {
      const railway = getRailway();
      const result = await railway.environments.rename({
        variables: {
          id: environmentId,
          input: {
            name,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const environmentResult = unwrapField(
        result,
        'environmentRename',
        'Failed to rename environment.',
      );
      if (environmentResult.isErr()) {
        return errorResponse(environmentResult.error.message);
      }

      return successResponse({ environment: environmentResult.value });
    },
  );

  server.registerTool(
    'railway_environment_logs',
    {
      title: 'Get Environment Logs',
      description: 'Fetch logs for an environment.',
      inputSchema: {
        environmentId: environmentIdSchema,
        afterLimit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe('Maximum number of log entries to return after the anchor date.'),
        beforeLimit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe('Maximum number of log entries to return before the anchor date.'),
        filter: z.string().optional().describe('Optional substring to filter log messages.'),
        afterDate: z.string().optional().describe('ISO timestamp to retrieve logs after.'),
        beforeDate: z.string().optional().describe('ISO timestamp to retrieve logs before.'),
        anchorDate: z.string().optional().describe('ISO timestamp anchor point for pagination.'),
      },
      outputSchema: {
        logs: z.array(
          z.object({
            __typename: z.string().optional(),
            message: z.string(),
            severity: z.string().nullable(),
            timestamp: z.string(),
          }),
        ),
      },
    },
    async ({
      environmentId,
      afterLimit,
      beforeLimit,
      filter,
      afterDate,
      beforeDate,
      anchorDate,
    }) => {
      const railway = getRailway();
      const result = await railway.environments.logs({
        variables: {
          environmentId,
          afterLimit,
          beforeLimit,
          filter,
          afterDate,
          beforeDate,
          anchorDate,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const logsResult = unwrapArray(
        result,
        'environmentLogs',
        'Invalid response from Railway: expected array of logs.',
      );
      if (logsResult.isErr()) {
        return errorResponse(logsResult.error.message);
      }

      return successResponse({ logs: logsResult.value });
    },
  );

  server.registerTool(
    'railway_environment_get_by_name',
    {
      title: 'Get Environment by Name',
      description:
        'Get an environment by its name. Useful when environments_list returns empty results. Returns the environment ID (UUID) that can be used with other tools.',
      inputSchema: {
        projectId: projectIdSchema,
        name: environmentNameSchema,
      },
      outputSchema: {
        environment: z
          .object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string(),
            projectId: z.string(),
            isEphemeral: z.boolean(),
            createdAt: z.string(),
            updatedAt: z.string(),
            deletedAt: z.string().nullable(),
            unmergedChangesCount: z.number().int().nullable(),
            volumeInstances: z.array(
              z.object({
                __typename: z.string().optional(),
                id: z.string(),
                environmentId: z.string(),
                volumeId: z.string(),
                mountPath: z.string(),
                state: z.string(),
                createdAt: z.string(),
                currentSizeMB: z.number().nullable(),
                sizeMB: z.number().nullable(),
                region: z.string().nullable(),
                serviceId: z.string().nullable(),
                externalId: z.string().nullable(),
              }),
            ),
          })
          .nullable(),
      },
    },
    async ({ projectId, name }) => {
      const railway = getRailway();
      const listResult = await railway.environments.list({
        variables: {
          projectId,
          first: 100,
        },
      });

      if (listResult.isErr()) {
        return errorResponse(
          `Failed to list environments: ${toRailwayErrorMessage(listResult.error)}. Try creating the environment first using railway_environment_create.`,
        );
      }

      const environmentsResult = unwrapField(
        listResult,
        'environments',
        'Invalid response from Railway: environments not found.',
      );
      if (environmentsResult.isErr()) {
        return errorResponse(
          `Failed to retrieve environments: ${environmentsResult.error.message}. Try creating the environment first using railway_environment_create.`,
        );
      }

      const environments = environmentsResult.value as { id: string; name: string }[];
      const env = environments.find((e) => e.name === name);
      if (!env) {
        return successResponse({ environment: null });
      }

      const envResult = await railway.environments.get({
        variables: { id: env.id },
      });
      if (envResult.isErr()) {
        return errorResponse(toRailwayErrorMessage(envResult.error));
      }

      const fullEnv = unwrapField(envResult, 'environment', 'Environment not found.');
      if (fullEnv.isErr()) {
        return errorResponse(fullEnv.error.message);
      }

      return successResponse({ environment: fullEnv.value });
    },
  );
};
