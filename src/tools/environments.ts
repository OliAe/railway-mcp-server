import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project that will own the environment.');

const environmentNameSchema = z
  .string()
  .trim()
  .min(1, 'Environment name is required')
  .describe('Human-readable name for the new environment.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The ID of the environment.');

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
        environments: z.object({
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                name: z.string(),
                projectId: z.string(),
                isEphemeral: z.boolean(),
                createdAt: z.string(),
                updatedAt: z.string(),
                deletedAt: z.string().nullable(),
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
        const data = await railway.environments.list({
          variables: {
            projectId,
            isEphemeral: null,
            first: first ?? null,
            after: after ?? null,
            last: last ?? null,
            before: before ?? null,
          },
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          .min(1)
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
      try {
        const railway = getRailway();
        const result = await railway.environments.create({
          variables: {
            input: {
              projectId,
              name,
              sourceEnvironmentId: sourceEnvironmentId ?? null,
              ephemeral: ephemeral ?? null,
              stageInitialChanges: stageInitialChanges ?? null,
              applyChangesInBackground: applyChangesInBackground ?? null,
              skipInitialDeploys: skipInitialDeploys ?? null,
            },
          },
        });

        return successResponse({ environment: result.environmentCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          id: z.string(),
          name: z.string(),
        }),
      },
    },
    async ({ environmentId, name }) => {
      try {
        const railway = getRailway();
        const result = await railway.environments.rename({
          variables: {
            id: environmentId,
            input: {
              name,
            },
          },
        });

        return successResponse({ environment: result.environmentRename });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
      try {
        const railway = getRailway();
        const result = await railway.environments.logs({
          variables: {
            environmentId,
            afterLimit: afterLimit ?? null,
            beforeLimit: beforeLimit ?? null,
            filter: filter ?? null,
            afterDate: afterDate ?? null,
            beforeDate: beforeDate ?? null,
            anchorDate: anchorDate ?? null,
          },
        });

        return successResponse({ logs: result.environmentLogs });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
