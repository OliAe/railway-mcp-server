import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const serviceIdSchema = z
  .string()
  .uuid('Service ID must be a valid UUID')
  .describe('The ID of the service to attach the domain to.');

const environmentIdSchema = z
  .string()
  .uuid('Environment ID must be a valid UUID')
  .describe('The environment where the domain will be generated.');

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project.');

export const registerDomainTools = (server: McpServer): void => {
  server.registerTool(
    'railway_domain_generate',
    {
      title: 'Generate Service Domain',
      description: 'Generate a default railway.app domain for a service within an environment.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        targetPort: z
          .number()
          .int()
          .positive()
          .describe('Optional target port to route traffic to.')
          .optional(),
      },
      outputSchema: {
        domain: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          domain: z.string(),
          projectId: z.string().nullable(),
          serviceId: z.string(),
          environmentId: z.string(),
          suffix: z.string().nullable(),
          targetPort: z.number().int().nullable(),
          edgeId: z.string().nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
          deletedAt: z.string().nullable(),
        }),
      },
    },
    async ({ serviceId, environmentId, targetPort }) => {
      const railway = getRailway();
      const result = await railway.services.domains.create({
        variables: {
          input: {
            serviceId,
            environmentId,
            targetPort,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const domainResult = unwrapField(result, 'serviceDomainCreate', 'Failed to generate domain.');
      if (domainResult.isErr()) {
        return errorResponse(domainResult.error.message);
      }

      return successResponse({ domain: domainResult.value });
    },
  );

  server.registerTool(
    'railway_domains_list',
    {
      title: 'List Domains',
      description: 'List all domains for a service in an environment.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        serviceId: serviceIdSchema,
      },
      outputSchema: {
        domains: z.object({
          __typename: z.string().optional(),
        }),
      },
    },
    async ({ projectId, environmentId, serviceId }) => {
      const railway = getRailway();
      const result = await railway.domains.list({
        variables: {
          projectId,
          environmentId,
          serviceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const domainsResult = unwrapField(
        result,
        'domains',
        'Invalid response from Railway: domains not found.',
      );
      if (domainsResult.isErr()) {
        return errorResponse(domainsResult.error.message);
      }

      return successResponse({ domains: domainsResult.value });
    },
  );

  server.registerTool(
    'railway_custom_domain_create',
    {
      title: 'Create Custom Domain',
      description: 'Add a custom domain to a service.',
      inputSchema: {
        projectId: projectIdSchema,
        environmentId: environmentIdSchema,
        serviceId: serviceIdSchema,
        domain: z.string().min(1, 'Domain is required').describe('The custom domain name.'),
        targetPort: z
          .number()
          .int()
          .positive()
          .describe('Optional target port to route traffic to.')
          .optional(),
      },
      outputSchema: {
        domain: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          domain: z.string(),
          projectId: z.string().nullable(),
          serviceId: z.string(),
          environmentId: z.string(),
          targetPort: z.number().int().nullable(),
          edgeId: z.string().nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
          deletedAt: z.string().nullable(),
        }),
        __typename: z.string().optional(),
      },
    },
    async ({ projectId, environmentId, serviceId, domain, targetPort }) => {
      const railway = getRailway();
      const result = await railway.domains.custom.create({
        variables: {
          input: {
            projectId,
            environmentId,
            serviceId,
            domain,
            targetPort,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const domainResult = unwrapField(
        result,
        'customDomainCreate',
        'Failed to create custom domain.',
      );
      if (domainResult.isErr()) {
        return errorResponse(domainResult.error.message);
      }

      return successResponse({ domain: domainResult.value });
    },
  );

  server.registerTool(
    'railway_custom_domain_available',
    {
      title: 'Check Custom Domain Availability',
      description: 'Check if a custom domain is available for use.',
      inputSchema: {
        domain: z.string().min(1, 'Domain is required').describe('The custom domain to check.'),
      },
      outputSchema: {
        available: z.boolean(),
        message: z.string(),
        __typename: z.string().optional(),
      },
    },
    async ({ domain }) => {
      const railway = getRailway();
      const result = await railway.domains.custom.available({
        variables: {
          domain,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const availabilityResult = unwrapField(
        result,
        'customDomainAvailable',
        'Invalid response from Railway: domain availability not found.',
      );
      if (availabilityResult.isErr()) {
        return errorResponse(availabilityResult.error.message);
      }

      return successResponse(availabilityResult.value);
    },
  );
};
