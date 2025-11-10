import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField } from '@crisog/railway-sdk';
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
        __typename: z.string().optional(),
      },
    },
    async ({ workflowId }) => {
      const railway = getRailway();
      const result = await railway.projects.workflows.status({
        variables: { workflowId },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const workflowStatusResult = unwrapField(result, 'workflowStatus', 'Workflow not found.');
      if (workflowStatusResult.isErr()) {
        return errorResponse(workflowStatusResult.error.message);
      }

      const workflowStatus = workflowStatusResult.value;
      const workflow: {
        status: string;
        error: string | null;
        __typename?: string;
      } = {
        status: workflowStatus.status,
        error: workflowStatus.error ?? null,
      };
      if (workflowStatus.__typename) {
        workflow.__typename = workflowStatus.__typename;
      }

      return successResponse({ workflow });
    },
  );
};
