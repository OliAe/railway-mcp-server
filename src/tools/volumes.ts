import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField, unwrapArray } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project.');

const volumeInstanceIdSchema = z
  .string()
  .uuid('Volume instance ID must be a valid UUID')
  .describe('The ID of the volume instance.');

export const registerVolumeTools = (server: McpServer): void => {
  server.registerTool(
    'railway_volume_create',
    {
      title: 'Create Volume',
      description: 'Create a new volume for persistent storage.',
      inputSchema: {
        projectId: projectIdSchema,
        mountPath: z
          .string()
          .min(1, 'Mount path is required')
          .describe('Path to mount the volume.'),
        environmentId: z
          .string()
          .trim()
          .uuid('Environment ID must be a valid UUID')
          .describe('Environment ID to deploy the volume to.'),
        serviceId: z
          .string()
          .trim()
          .uuid('Service ID must be a valid UUID')
          .describe('Service ID to attach the volume to (optional, can be mounted later).')
          .optional(),
        region: z.string().trim().describe('Region to create the volume in.').optional(),
      },
      outputSchema: {
        volume: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          createdAt: z.string(),
        }),
      },
    },
    async ({ projectId, mountPath, environmentId, serviceId, region }) => {
      const railway = getRailway();
      const result = await railway.volumes.create({
        variables: {
          input: {
            projectId,
            mountPath,
            environmentId,
            serviceId,
            region,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const volumeResult = unwrapField(result, 'volumeCreate', 'Failed to create volume.');
      if (volumeResult.isErr()) {
        return errorResponse(volumeResult.error.message);
      }

      return successResponse({ volume: volumeResult.value });
    },
  );

  server.registerTool(
    'railway_volume_instance_backup_create',
    {
      title: 'Create Volume Backup',
      description: 'Create a backup of a volume instance.',
      inputSchema: {
        volumeInstanceId: volumeInstanceIdSchema,
      },
      outputSchema: {
        workflowId: z.string().nullable(),
      },
    },
    async ({ volumeInstanceId }) => {
      const railway = getRailway();
      const result = await railway.volumes.instance.backups.create({
        variables: {
          volumeInstanceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const backupResult = unwrapField(
        result,
        'volumeInstanceBackupCreate',
        'Invalid response from Railway: workflow ID not found.',
      );
      if (backupResult.isErr()) {
        return errorResponse(backupResult.error.message);
      }

      const workflowIdResult = unwrapField(
        backupResult,
        'workflowId',
        'Invalid response from Railway: workflow ID not found.',
      );
      if (workflowIdResult.isErr()) {
        return errorResponse(workflowIdResult.error.message);
      }

      return successResponse({ workflowId: workflowIdResult.value });
    },
  );

  server.registerTool(
    'railway_volume_instance_backup_list',
    {
      title: 'List Volume Backups',
      description: 'List all backups for a volume instance.',
      inputSchema: {
        volumeInstanceId: volumeInstanceIdSchema,
      },
      outputSchema: {
        backups: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string().nullable(),
            createdAt: z.string(),
            expiresAt: z.string().nullable(),
            usedMB: z.number().nullable(),
            referencedMB: z.number().nullable(),
            creatorId: z.string().nullable(),
            externalId: z.string(),
          }),
        ),
        __typename: z.string().optional(),
      },
    },
    async ({ volumeInstanceId }) => {
      const railway = getRailway();
      const result = await railway.volumes.instance.backups.list({
        variables: {
          volumeInstanceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const backupsResult = unwrapArray(
        result,
        'volumeInstanceBackupList',
        'Invalid response from Railway: expected array of backups.',
      );
      if (backupsResult.isErr()) {
        return errorResponse(backupsResult.error.message);
      }

      return successResponse({ backups: backupsResult.value });
    },
  );

  server.registerTool(
    'railway_volume_instance_backup_restore',
    {
      title: 'Restore Volume Backup',
      description: 'Restore a volume instance from a backup.',
      inputSchema: {
        volumeInstanceId: volumeInstanceIdSchema,
        backupId: z
          .string()
          .uuid('Backup ID must be a valid UUID')
          .describe('The ID of the backup to restore.'),
      },
      outputSchema: {
        workflowId: z.string().nullable(),
      },
    },
    async ({ volumeInstanceId, backupId }) => {
      const railway = getRailway();
      const result = await railway.volumes.instance.backups.restore({
        variables: {
          volumeInstanceId,
          volumeInstanceBackupId: backupId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const restoreResult = unwrapField(
        result,
        'volumeInstanceBackupRestore',
        'Invalid response from Railway: workflow ID not found.',
      );
      if (restoreResult.isErr()) {
        return errorResponse(restoreResult.error.message);
      }

      const workflowIdResult = unwrapField(
        restoreResult,
        'workflowId',
        'Invalid response from Railway: workflow ID not found.',
      );
      if (workflowIdResult.isErr()) {
        return errorResponse(workflowIdResult.error.message);
      }

      return successResponse({ workflowId: workflowIdResult.value });
    },
  );

  server.registerTool(
    'railway_volume_instances_list',
    {
      title: 'List Volume Instances',
      description: 'List all volume instances for an environment (temporary tool for testing).',
      inputSchema: {
        environmentId: z
          .string()
          .uuid('Environment ID must be a valid UUID')
          .describe('The ID of the environment.'),
      },
      outputSchema: {
        instances: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            environmentId: z.string(),
            mountPath: z.string(),
            state: z.string().nullable(),
            volumeId: z.string(),
            createdAt: z.string(),
            currentSizeMB: z.number().nullable(),
            sizeMB: z.number().nullable(),
            region: z.string().nullable(),
            serviceId: z.string().nullable(),
            externalId: z.string().nullable(),
          }),
        ),
      },
    },
    async ({ environmentId }) => {
      const railway = getRailway();
      const result = await railway.environments.get({
        variables: { id: environmentId },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const environmentResult = unwrapField(result, 'environment', 'Environment not found.');
      if (environmentResult.isErr()) {
        return errorResponse(environmentResult.error.message);
      }

      const environment = environmentResult.value as {
        volumeInstances?: {
          edges?: { node: unknown }[];
        } | null;
      };

      if (!environment.volumeInstances) {
        return errorResponse(
          `Volume instances field not found in response. This may indicate the GraphQL query needs to be regenerated. Response keys: ${Object.keys(environment).join(', ')}`,
        );
      }

      const instances = environment.volumeInstances?.edges?.map((edge) => edge.node) ?? [];

      return successResponse({ instances });
    },
  );
};
