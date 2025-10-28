import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

export const registerProjectTools = (server: McpServer): void => {
  server.registerTool(
    'railway_projects_list',
    {
      title: 'List Projects',
      description: 'Gets all projects for a user or workspace.',
      inputSchema: {
        userId: z.string().min(1).describe('Filter projects by user ID.').optional(),
        workspaceId: z.string().min(1).describe('Filter projects by workspace ID.').optional(),
        includeDeleted: z.boolean().describe('Include deleted projects.').optional(),
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
        projects: z.object({
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                createdAt: z.string(),
                updatedAt: z.string(),
                isPublic: z.boolean(),
                isTempProject: z.boolean(),
                teamId: z.string().nullable(),
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
    async ({ userId, workspaceId, includeDeleted, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      try {
        const railway = getRailway();
        const data = await railway.projects.list({
          variables: {
            userId: userId ?? null,
            workspaceId: workspaceId ?? null,
            includeDeleted: includeDeleted ?? null,
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
    'railway_project_get',
    {
      title: 'Get Project',
      description: 'Retrieve high-level information about a project.',
      inputSchema: {
        projectId: projectIdSchema,
      },
      outputSchema: {
        project: z
          .object({
            id: z.string(),
            name: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ projectId }) => {
      try {
        const railway = getRailway();
        const data = await railway.projects.get({
          variables: {
            id: projectId,
          },
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_project_schedule_delete',
    {
      title: 'Schedule Project Deletion',
      description: 'Schedules a project for deletion, applying the standard 48 hour grace period.',
      inputSchema: {
        projectId: projectIdSchema,
      },
      outputSchema: {
        scheduled: z.boolean(),
      },
    },
    async ({ projectId }) => {
      try {
        const railway = getRailway();
        const result = await railway.projects.schedules.delete({
          variables: {
            id: projectId,
          },
        });

        return successResponse({ scheduled: result.projectScheduleDelete });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
