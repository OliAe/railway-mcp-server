import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

const volumeInstanceIdSchema = z
  .string()
  .min(1, 'Volume instance ID is required')
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
          .min(1, 'Environment ID is required')
          .describe('Environment ID to deploy the volume to.'),
        serviceId: z
          .string()
          .trim()
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
      try {
        const railway = getRailway();
        const result = await railway.volumes.create({
          variables: {
            input: {
              projectId,
              mountPath,
              environmentId,
              serviceId: serviceId ?? null,
              region: region ?? null,
            },
          },
        });

        return successResponse({ volume: result.volumeCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
        backup: z.object({
          id: z.string(),
          name: z.string().nullable(),
          createdAt: z.string(),
        }),
      },
    },
    async ({ volumeInstanceId }) => {
      try {
        const railway = getRailway();
        const result = await railway.volumes.instance.backups.create({
          variables: {
            volumeInstanceId,
          },
        });

        return successResponse({ backup: result.volumeInstanceBackupCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
            id: z.string(),
            name: z.string().nullable(),
            createdAt: z.string(),
            expiresAt: z.string().nullable(),
            usedMB: z.number().nullable(),
            referencedMB: z.number().nullable(),
          }),
        ),
      },
    },
    async ({ volumeInstanceId }) => {
      try {
        const railway = getRailway();
        const result = await railway.volumes.instance.backups.list({
          variables: {
            volumeInstanceId,
          },
        });

        return successResponse({ backups: result.volumeInstanceBackupList });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          .min(1, 'Backup ID is required')
          .describe('The ID of the backup to restore.'),
      },
      outputSchema: {
        workflowId: z.string().nullable(),
      },
    },
    async ({ volumeInstanceId, backupId }) => {
      try {
        const railway = getRailway();
        const result = await railway.volumes.instance.backups.restore({
          variables: {
            volumeInstanceId,
            volumeInstanceBackupId: backupId,
          },
        });

        return successResponse({ workflowId: result.volumeInstanceBackupRestore.workflowId });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
