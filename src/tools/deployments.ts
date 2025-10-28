import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const deploymentStatusValues = [
  'BUILDING',
  'CRASHED',
  'DEPLOYING',
  'FAILED',
  'INITIALIZING',
  'NEEDS_APPROVAL',
  'QUEUED',
  'REMOVED',
  'REMOVING',
  'SKIPPED',
  'SLEEPING',
  'SUCCESS',
  'WAITING',
] as const;

const deploymentStatusEnum = z.enum(deploymentStatusValues);

const deploymentIdSchema = z
  .string()
  .min(1, 'Deployment ID is required')
  .describe('The ID of the deployment.');

export const registerDeploymentTools = (server: McpServer): void => {
  server.registerTool(
    'railway_deployment_list',
    {
      title: 'List Deployments',
      description: 'List deployments for a project, optionally filtered.',
      inputSchema: {
        projectId: z
          .string()
          .min(1, 'Project ID is required')
          .describe('Filter deployments by project ID.'),
        serviceId: z.string().min(1).describe('Filter deployments by service ID.').optional(),
        environmentId: z
          .string()
          .min(1)
          .describe('Filter deployments by environment ID.')
          .optional(),
        includeDeleted: z
          .boolean()
          .describe('Include deployments that have been deleted.')
          .optional(),
        statusIn: z
          .array(deploymentStatusEnum)
          .nonempty()
          .describe('Only include deployments with these statuses.')
          .optional(),
        statusNotIn: z
          .array(deploymentStatusEnum)
          .nonempty()
          .describe('Exclude deployments with these statuses.')
          .optional(),
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
        deployments: z.object({
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                status: z.string(),
                createdAt: z.string(),
                updatedAt: z.string(),
                projectId: z.string(),
                serviceId: z.string().nullable(),
                environmentId: z.string(),
                url: z.string().nullable(),
                staticUrl: z.string().nullable(),
                canRedeploy: z.boolean(),
                canRollback: z.boolean(),
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
    async ({
      projectId,
      serviceId,
      environmentId,
      includeDeleted,
      statusIn,
      statusNotIn,
      first,
      after,
      last,
      before,
    }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      try {
        const railway = getRailway();
        const data = await railway.deployments.list({
          variables: {
            input: {
              projectId,
              serviceId: serviceId ?? null,
              environmentId: environmentId ?? null,
              includeDeleted: includeDeleted ?? null,
              status:
                statusIn || statusNotIn
                  ? {
                      in: statusIn ?? null,
                      notIn: statusNotIn ?? null,
                    }
                  : null,
            },
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
    'railway_deployment_get',
    {
      title: 'Get Deployment',
      description: 'Fetch detailed information about a deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
            environmentId: z.string(),
            projectId: z.string(),
            serviceId: z.string().nullable(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId }) => {
      try {
        const railway = getRailway();
        const data = await railway.deployments.get({
          variables: {
            id: deploymentId,
          },
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_logs',
    {
      title: 'Get Deployment Logs',
      description: 'Fetch logs for a deployment.',
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
            message: z.string(),
            severity: z.string().nullable(),
            timestamp: z.string(),
          }),
        ),
      },
    },
    async ({ deploymentId, limit, filter, startDate, endDate }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.logs({
          variables: {
            deploymentId,
            limit: limit ?? null,
            filter: filter ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
          },
        });

        return successResponse({ logs: result.deploymentLogs });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_redeploy',
    {
      title: 'Redeploy',
      description: 'Redeploy a previous deployment, optionally reusing the image tag.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
        usePreviousImageTag: z
          .boolean()
          .optional()
          .describe('If true, reuse the previous image tag.'),
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
            environmentId: z.string(),
            projectId: z.string(),
            serviceId: z.string().nullable(),
            url: z.string().nullable(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId, usePreviousImageTag }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.redeploy({
          variables: {
            id: deploymentId,
            usePreviousImageTag: usePreviousImageTag ?? null,
          },
        });

        return successResponse({ deployment: result.deploymentRedeploy });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_stop',
    {
      title: 'Stop Deployment',
      description: 'Stop a running deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.stop({
          variables: {
            id: deploymentId,
          },
        });

        return successResponse({ deployment: result.deploymentStop });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_restart',
    {
      title: 'Restart Deployment',
      description: 'Restart a deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.restart({
          variables: {
            id: deploymentId,
          },
        });

        return successResponse({ deployment: result.deploymentRestart });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_cancel',
    {
      title: 'Cancel Deployment',
      description: 'Cancel a pending or in-progress deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.cancel({
          variables: {
            id: deploymentId,
          },
        });

        return successResponse({ deployment: result.deploymentCancel });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_rollback',
    {
      title: 'Rollback Deployment',
      description: 'Rollback to a previous deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
      },
      outputSchema: {
        deployment: z
          .object({
            id: z.string(),
            status: z.string(),
          })
          .passthrough(),
      },
    },
    async ({ deploymentId }) => {
      try {
        const railway = getRailway();
        const result = await railway.deployments.rollback({
          variables: {
            id: deploymentId,
          },
        });

        return successResponse({ deployment: result.deploymentRollback });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_deployment_events',
    {
      title: 'Get Deployment Events',
      description: 'Fetch events for a deployment.',
      inputSchema: {
        deploymentId: deploymentIdSchema,
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
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                action: z.string(),
                createdAt: z.string(),
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
    async ({ deploymentId, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      try {
        const railway = getRailway();
        const data = await railway.deployments.events({
          variables: {
            id: deploymentId,
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
};
