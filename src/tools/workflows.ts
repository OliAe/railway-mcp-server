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
          __typename: z.string().optional(),
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

        const workflow: {
          status: string;
          error: string | null;
          __typename?: string;
        } = {
          status: result.workflowStatus.status,
          error: result.workflowStatus.error ?? null,
        };
        if (result.workflowStatus.__typename) {
          workflow.__typename = result.workflowStatus.__typename;
        }

        return successResponse({ workflow });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
