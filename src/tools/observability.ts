import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField, unwrapArray } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const deploymentIdSchema = z
  .string()
  .min(1, 'Deployment ID is required')
  .describe('The ID of the deployment.');

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

export const registerObservabilityTools = (server: McpServer): void => {
  server.registerTool(
    'railway_observability_http_logs',
    {
      title: 'Get HTTP Logs',
      description: 'Retrieve HTTP request logs for a deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe('Maximum number of log entries to return.'),
        filter: z.string().optional().describe('Optional substring to filter log messages.'),
        startDate: z.string().optional().describe('ISO timestamp to start log retrieval.'),
        endDate: z.string().optional().describe('ISO timestamp to end log retrieval.'),
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
        afterDate: z.string().optional().describe('ISO timestamp to retrieve logs after.'),
        beforeDate: z.string().optional().describe('ISO timestamp to retrieve logs before.'),
        anchorDate: z.string().optional().describe('ISO timestamp anchor point for pagination.'),
      },
      outputSchema: {
        logs: z.array(
          z.object({
            __typename: z.string().optional(),
            clientUa: z.string(),
            deploymentId: z.string(),
            deploymentInstanceId: z.string(),
            downstreamProto: z.string(),
            edgeRegion: z.string(),
            host: z.string(),
            httpStatus: z.number(),
            method: z.string(),
            path: z.string(),
            requestId: z.string(),
            responseDetails: z.string(),
            rxBytes: z.number(),
            srcIp: z.string(),
            timestamp: z.string(),
            totalDuration: z.number(),
            txBytes: z.number(),
            upstreamAddress: z.string(),
            upstreamProto: z.string(),
            upstreamRqDuration: z.number(),
          }),
        ),
        __typename: z.string().optional(),
      },
    },
    async ({
      deploymentId,
      limit,
      filter,
      startDate,
      endDate,
      afterLimit,
      beforeLimit,
      afterDate,
      beforeDate,
      anchorDate,
    }) => {
      const railway = getRailway();
      const result = await railway.observability.logs.http({
        variables: {
          deploymentId,
          limit: limit ?? null,
          filter: filter ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          afterLimit: afterLimit ?? null,
          beforeLimit: beforeLimit ?? null,
          afterDate: afterDate ?? null,
          beforeDate: beforeDate ?? null,
          anchorDate: anchorDate ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const logsResult = unwrapArray(
        result,
        'httpLogs',
        'Invalid response from Railway: expected array of HTTP logs.',
      );
      if (logsResult.isErr()) {
        return errorResponse(logsResult.error.message);
      }

      return successResponse({ logs: logsResult.value });
    },
  );

  server.registerTool(
    'railway_observability_build_logs',
    {
      title: 'Get Build Logs',
      description: 'Retrieve build logs for a deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe('Maximum number of log entries to return.'),
        filter: z.string().optional().describe('Optional substring to filter log messages.'),
        startDate: z.string().optional().describe('ISO timestamp to start log retrieval.'),
        endDate: z.string().optional().describe('ISO timestamp to end log retrieval.'),
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
        __typename: z.string().optional(),
      },
    },
    async ({ deploymentId, limit, filter, startDate, endDate }) => {
      const railway = getRailway();
      const result = await railway.observability.logs.build({
        variables: {
          deploymentId,
          limit: limit ?? null,
          filter: filter ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const logsResult = unwrapArray(
        result,
        'buildLogs',
        'Invalid response from Railway: expected array of build logs.',
      );
      if (logsResult.isErr()) {
        return errorResponse(logsResult.error.message);
      }

      return successResponse({ logs: logsResult.value });
    },
  );

  server.registerTool(
    'railway_observability_events',
    {
      title: 'Get System Events',
      description: 'Retrieve system events for a project.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: z.string().trim().describe('Filter by environment ID.').optional(),
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
        events: z.object({
          __typename: z.string().optional(),
        }),
      },
    },
    async ({ projectId, environmentId, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.observability.events({
        variables: {
          projectId,
          environmentId: environmentId ?? null,
          filter: null,
          first: first ?? null,
          after: after ?? null,
          last: last ?? null,
          before: before ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const eventsResult = unwrapField(
        result,
        'events',
        'Invalid response from Railway: events not found.',
      );
      if (eventsResult.isErr()) {
        return errorResponse(eventsResult.error.message);
      }

      return successResponse({ events: eventsResult.value });
    },
  );
};
