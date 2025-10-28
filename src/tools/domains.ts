import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const serviceIdSchema = z
  .string()
  .min(1, 'Service ID is required')
  .describe('The ID of the service to attach the domain to.');

const environmentIdSchema = z
  .string()
  .min(1, 'Environment ID is required')
  .describe('The environment where the domain will be generated.');

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

const domainIdSchema = z.string().min(1, 'Domain ID is required').describe('The ID of the domain.');

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
          id: z.string(),
          domain: z.string(),
          projectId: z.string().nullable(),
          serviceId: z.string(),
          environmentId: z.string(),
          suffix: z.string().nullable(),
          targetPort: z.number().int().nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
          deletedAt: z.string().nullable(),
        }),
      },
    },
    async ({ serviceId, environmentId, targetPort }) => {
      try {
        const railway = getRailway();
        const result = await railway.services.domains.create({
          variables: {
            input: {
              serviceId,
              environmentId,
              targetPort: targetPort ?? null,
            },
          },
        });

        return successResponse({ domain: result.serviceDomainCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          serviceDomains: z.array(
            z.object({
              id: z.string(),
              domain: z.string(),
              targetPort: z.number().int().nullable(),
            }),
          ),
          customDomains: z.array(
            z.object({
              id: z.string(),
              domain: z.string(),
              targetPort: z.number().int().nullable(),
            }),
          ),
        }),
      },
    },
    async ({ projectId, environmentId, serviceId }) => {
      try {
        const railway = getRailway();
        const data = await railway.domains.list({
          variables: {
            projectId,
            environmentId,
            serviceId,
          },
        });

        return successResponse(data);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          id: z.string(),
          domain: z.string(),
          projectId: z.string().nullable(),
          serviceId: z.string(),
          environmentId: z.string(),
          targetPort: z.number().int().nullable(),
          createdAt: z.string().nullable(),
          updatedAt: z.string().nullable(),
        }),
      },
    },
    async ({ projectId, environmentId, serviceId, domain, targetPort }) => {
      try {
        const railway = getRailway();
        const result = await railway.domains.custom.create({
          variables: {
            input: {
              projectId,
              environmentId,
              serviceId,
              domain,
              targetPort: targetPort ?? null,
            },
          },
        });

        return successResponse({ domain: result.customDomainCreate });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_custom_domain_delete',
    {
      title: 'Delete Custom Domain',
      description: 'Remove a custom domain from a service.',
      inputSchema: {
        domainId: domainIdSchema,
      },
      outputSchema: {
        deleted: z.boolean(),
      },
    },
    async ({ domainId }) => {
      try {
        const railway = getRailway();
        const result = await railway.domains.custom.delete({
          variables: {
            id: domainId,
          },
        });

        return successResponse({ deleted: result.customDomainDelete });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
      },
    },
    async ({ domain }) => {
      try {
        const railway = getRailway();
        const result = await railway.domains.custom.available({
          variables: {
            domain,
          },
        });

        return successResponse(result.customDomainAvailable);
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
