import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField, unwrapArray } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project.');

const environmentIdSchema = z
  .string()
  .uuid('Environment ID must be a valid UUID')
  .describe('The ID of the environment.');

const serviceIdSchema = z
  .string()
  .uuid('Service ID must be a valid UUID')
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
          __typename: z.string().optional(),
          publicId: z.string(),
          name: z.string(),
          environmentId: z.string(),
          projectId: z.string(),
          dnsName: z.string(),
          networkId: z.any(),
          tags: z.array(z.string()),
          createdAt: z.string().nullable(),
          deletedAt: z.string().nullable(),
        }),
      },
    },
    async ({ projectId, environmentId, name, tags }) => {
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

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const networkResult = unwrapField(
        result,
        'privateNetworkCreateOrGet',
        'Failed to create or get private network.',
      );
      if (networkResult.isErr()) {
        return errorResponse(networkResult.error.message);
      }

      return successResponse({ network: networkResult.value });
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
            __typename: z.string().optional(),
            publicId: z.string(),
            name: z.string(),
            environmentId: z.string(),
            projectId: z.string(),
            dnsName: z.string(),
            networkId: z.any(),
            tags: z.array(z.string()),
            createdAt: z.string().nullable(),
            deletedAt: z.string().nullable(),
          }),
        ),
      },
    },
    async ({ environmentId }) => {
      const railway = getRailway();
      const result = await railway.networking.privateNetworks.list({
        variables: {
          environmentId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const networksResult = unwrapArray(
        result,
        'privateNetworks',
        'Invalid response from Railway: expected array of networks.',
      );
      if (networksResult.isErr()) {
        return errorResponse(networksResult.error.message);
      }

      return successResponse({ networks: networksResult.value });
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
      const railway = getRailway();
      const result = await railway.networking.tcpProxies.list({
        variables: {
          environmentId,
          serviceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const proxiesResult = unwrapArray(
        result,
        'tcpProxies',
        'Invalid response from Railway: expected array of TCP proxies.',
      );
      if (proxiesResult.isErr()) {
        return errorResponse(proxiesResult.error.message);
      }

      return successResponse({ proxies: proxiesResult.value });
    },
  );
};
