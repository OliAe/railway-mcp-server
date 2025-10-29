import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The ID of the environment.');

const serviceIdSchema = z
  .string()
  .min(1, 'Service ID is required')
  .describe('The ID of the service.');

export const registerNetworkingTools = (server: McpServer): void => {
  server.registerTool(
    'railway_private_network_create_or_get',
    {
      title: 'Create or Get Private Network',
      description: 'Create a new private network or retrieve an existing one.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        name: z
          .string()
          .min(1, 'Network name is required')
          .describe('Name of the private network.'),
        tags: z
          .array(z.string())
          .describe('Tags to associate with the private network.')
          .default([]),
      },
      outputSchema: {
        network: z.object({
          publicId: z.string(),
          name: z.string(),
          environmentId: z.string(),
          projectId: z.string(),
          dnsName: z.string(),
          networkId: z.number(),
          tags: z.array(z.string()),
          createdAt: z.string().nullable(),
        }),
      },
    },
    async ({ projectId, environmentId, name, tags }) => {
      try {
        const railway = getRailway();
        const result = await railway.networking.privateNetworks.createOrGet({
          variables: {
            input: {
              projectId,
              environmentId,
              name,
              tags,
            },
          },
        });

        return successResponse({ network: result.privateNetworkCreateOrGet });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_private_networks_list',
    {
      title: 'List Private Networks',
      description: 'List all private networks for an environment.',
      inputSchema: {
        environmentId: environmentIdSchema,
      },
      outputSchema: {
        networks: z.array(
          z.object({
            publicId: z.string(),
            name: z.string(),
            environmentId: z.string(),
            projectId: z.string(),
            dnsName: z.string(),
            networkId: z.number(),
            tags: z.array(z.string()),
            createdAt: z.string().nullable(),
            deletedAt: z.string().nullable(),
          }),
        ),
      },
    },
    async ({ environmentId }) => {
      try {
        const railway = getRailway();
        const result = await railway.networking.privateNetworks.list({
          variables: {
            environmentId,
          },
        });

        return successResponse({ networks: result.privateNetworks });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_tcp_proxies_list',
    {
      title: 'List TCP Proxies',
      description: 'List all TCP proxies for a service in an environment.',
      inputSchema: {
        environmentId: environmentIdSchema,
        serviceId: serviceIdSchema,
      },
      outputSchema: {
        proxies: z.array(
          z.object({
            id: z.string(),
            domain: z.string(),
            applicationPort: z.number().int(),
            proxyPort: z.number().int(),
            serviceId: z.string(),
            environmentId: z.string(),
            createdAt: z.string().nullable(),
            updatedAt: z.string().nullable(),
            deletedAt: z.string().nullable(),
          }),
        ),
      },
    },
    async ({ environmentId, serviceId }) => {
      try {
        const railway = getRailway();
        const result = await railway.networking.tcpProxies.list({
          variables: {
            environmentId,
            serviceId,
          },
        });

        return successResponse({ proxies: result.tcpProxies });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
