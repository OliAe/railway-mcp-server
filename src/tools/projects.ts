import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { project as fetchProject, projectScheduleDelete } from 'railway-sdk';

import { getRailwayClient, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

type ProjectQueryResult = Awaited<ReturnType<typeof fetchProject>>;
type ProjectScheduleDeleteResult = Awaited<ReturnType<typeof projectScheduleDelete>>;

export const registerProjectTools = (server: McpServer): void => {
  server.registerTool(
    'railway.project.get',
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
        const client = getRailwayClient();
        const data: ProjectQueryResult = await fetchProject(client, {
          id: projectId,
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway.project.schedule_delete',
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
        const client = getRailwayClient();
        const result: ProjectScheduleDeleteResult = await projectScheduleDelete(client, {
          id: projectId,
        });

        return successResponse({ scheduled: result.projectScheduleDelete });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
