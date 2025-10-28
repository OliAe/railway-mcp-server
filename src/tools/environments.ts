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

export const registerEnvironmentTools = (server: McpServer): void => {
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
};
