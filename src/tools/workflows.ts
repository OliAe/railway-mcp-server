import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

export const registerWorkflowTools = (server: McpServer): void => {
  server.registerTool(
    'railway_workflow_status',
    {
      title: 'Get Workflow Status',
      description:
        'Check the status of an asynchronous Railway workflow (e.g., template deployments).',
      inputSchema: {
        workflowId: z.string().trim().min(1).describe('Workflow ID to look up.'),
      },
      outputSchema: {
        workflow: z.object({
          status: z.string(),
          error: z.string().nullable(),
        }),
      },
    },
    async ({ workflowId }) => {
      try {
        const railway = getRailway();
        const result = await railway.projects.workflows.status({
          variables: { workflowId },
        });

        if (!result.workflowStatus) {
          return errorResponse('Workflow not found.');
        }

        return successResponse({
          workflow: {
            status: result.workflowStatus.status,
            error: result.workflowStatus.error,
          },
        });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
