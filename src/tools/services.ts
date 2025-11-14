import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapField, unwrapNested } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const serviceIdSchema = z
  .string()
  .uuid('Service ID must be a valid UUID')
  .describe('The ID of the service.');

const environmentIdSchema = z
  .string()
  .uuid('Environment ID must be a valid UUID')
  .describe('The ID of the environment.');

export const registerServiceTools = (server: McpServer): void => {
  server.registerTool(
    'railway_services_list',
    {
      title: 'List Services',
      description: 'List all services in a project.',
      inputSchema: {
        projectId: z
          .string()
          .uuid('Project ID must be a valid UUID')
          .describe('The ID of the project.'),
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
        services: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string(),
            icon: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
            deletedAt: z.string().nullable(),
            projectId: z.string(),
            templateServiceId: z.string().nullable(),
            templateThreadSlug: z.string().nullable(),
          }),
        ),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          hasPreviousPage: z.boolean(),
          startCursor: z.string().nullable(),
          endCursor: z.string().nullable(),
        }),
      },
    },
    async ({ projectId, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.services.list({
        variables: {
          projectId,
          first,
          after,
          last,
          before,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const servicesResult = unwrapNested(
        result,
        ['project', 'services'] as const,
        'Invalid response from Railway: services not found.',
      );
      if (servicesResult.isErr()) {
        return errorResponse(servicesResult.error.message);
      }

      return successResponse({
        services: servicesResult.value,
        pageInfo: servicesResult.value.pageInfo,
      });
    },
  );

  server.registerTool(
    'railway_service_get',
    {
      title: 'Get Service',
      description: 'Retrieve details about a specific service.',
      inputSchema: {
        serviceId: serviceIdSchema,
      },
      outputSchema: {
        service: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          icon: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deletedAt: z.string().nullable(),
          templateServiceId: z.string().nullable(),
          templateThreadSlug: z.string().nullable(),
          featureFlags: z.array(z.string()),
        }),
      },
    },
    async ({ serviceId }) => {
      const railway = getRailway();
      const result = await railway.services.get({
        variables: {
          id: serviceId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const serviceResult = unwrapField(result, 'service', 'Service not found.');
      if (serviceResult.isErr()) {
        return errorResponse(serviceResult.error.message);
      }

      return successResponse({ service: serviceResult.value });
    },
  );

  server.registerTool(
    'railway_service_update',
    {
      title: 'Update Service',
      description: "Update a service's metadata such as name or icon.",
      inputSchema: {
        serviceId: serviceIdSchema,
        name: z.string().trim().min(1).describe('New service name.').optional(),
        icon: z.string().trim().min(1).describe('Icon URL for the service.').optional(),
      },
      outputSchema: {
        service: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          icon: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deletedAt: z.string().nullable(),
          templateServiceId: z.string().nullable(),
          templateThreadSlug: z.string().nullable(),
          featureFlags: z.array(z.string()),
        }),
      },
    },
    async ({ serviceId, name, icon }) => {
      if (!name && !icon) {
        return errorResponse('Provide at least one field to update.');
      }

      const railway = getRailway();
      const result = await railway.services.update({
        variables: {
          id: serviceId,
          input: {
            name,
            icon,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const serviceResult = unwrapField(
        result,
        'serviceUpdate',
        'Service not found or update failed.',
      );
      if (serviceResult.isErr()) {
        return errorResponse(serviceResult.error.message);
      }

      return successResponse({ service: serviceResult.value });
    },
  );

  server.registerTool(
    'railway_service_deploy_latest',
    {
      title: 'Deploy Service (Latest Commit)',
      description:
        'Trigger a deployment for a service instance using the latest code or a specific commit.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        commitSha: z.string().trim().min(7).describe('Optional commit SHA to deploy.').optional(),
      },
      outputSchema: {
        deploymentId: z.string(),
      },
    },
    async ({ serviceId, environmentId, commitSha }) => {
      const railway = getRailway();
      const result = await railway.services.instances.deployV2({
        variables: {
          serviceId,
          environmentId,
          commitSha,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const deploymentIdResult = unwrapField(
        result,
        'serviceInstanceDeployV2',
        'Failed to deploy service.',
      );
      if (deploymentIdResult.isErr()) {
        return errorResponse(deploymentIdResult.error.message);
      }

      return successResponse({ deploymentId: deploymentIdResult.value });
    },
  );

  server.registerTool(
    'railway_service_create',
    {
      title: 'Create Service',
      description: 'Create a new service in a project.',
      inputSchema: {
        projectId: z
          .string()
          .uuid('Project ID must be a valid UUID')
          .describe('The ID of the project.'),
        environmentId: z
          .string()
          .trim()
          .uuid('Environment ID must be a valid UUID')
          .describe('Environment ID where the service will be created.'),
        name: z.string().trim().min(1).describe('Name for the service.').optional(),
        icon: z.string().trim().describe('Icon URL for the service.').optional(),
        branch: z.string().trim().describe('Git branch for the service.').optional(),
      },
      outputSchema: {
        service: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          projectId: z.string(),
          icon: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          deletedAt: z.string().nullable(),
          templateServiceId: z.string().nullable(),
          templateThreadSlug: z.string().nullable(),
          featureFlags: z.array(z.string()),
        }),
      },
    },
    async ({ projectId, environmentId, name, icon, branch }) => {
      const railway = getRailway();
      const result = await railway.services.create({
        variables: {
          input: {
            projectId,
            environmentId,
            name,
            icon,
            branch,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const serviceResult = unwrapField(result, 'serviceCreate', 'Failed to create service.');
      if (serviceResult.isErr()) {
        return errorResponse(serviceResult.error.message);
      }

      return successResponse({ service: serviceResult.value });
    },
  );

  server.registerTool(
    'railway_service_instance_build_command',
    {
      title: 'Update Service Instance Build Command',
      description:
        'Update the build command for a service instance. Warning: Changes will only take effect on the next deployment. After updating this setting, you must trigger a new deployment using railway_service_deploy_latest to apply the changes.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        buildCommand: z
          .string()
          .trim()
          .min(1, 'Build command cannot be empty.')
          .describe('Command to run during the build phase.'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    async ({ serviceId, environmentId, buildCommand }) => {
      const railway = getRailway();
      const result = await railway.services.instances.update({
        variables: {
          serviceId,
          environmentId,
          input: {
            buildCommand,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const updateResult = unwrapField(
        result,
        'serviceInstanceUpdate',
        'Service instance not found or update failed.',
      );
      if (updateResult.isErr()) {
        return errorResponse(updateResult.error.message);
      }

      return successResponse({ success: updateResult.value });
    },
  );

  server.registerTool(
    'railway_service_instance_start_command',
    {
      title: 'Update Service Instance Start Command',
      description:
        'Update the start command for a service instance. Warning: Changes will only take effect on the next deployment. After updating this setting, you must trigger a new deployment using railway_service_deploy_latest to apply the changes.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        startCommand: z
          .string()
          .trim()
          .min(1, 'Start command cannot be empty.')
          .describe('Command to run when starting the service.'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    async ({ serviceId, environmentId, startCommand }) => {
      const railway = getRailway();
      const result = await railway.services.instances.update({
        variables: {
          serviceId,
          environmentId,
          input: {
            startCommand,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const updateResult = unwrapField(
        result,
        'serviceInstanceUpdate',
        'Service instance not found or update failed.',
      );
      if (updateResult.isErr()) {
        return errorResponse(updateResult.error.message);
      }

      return successResponse({ success: updateResult.value });
    },
  );

  server.registerTool(
    'railway_service_instance_predeploy',
    {
      title: 'Update Service Instance Pre-deploy Commands',
      description:
        'Update the pre-deploy commands for a service instance. Warning: Changes will only take effect on the next deployment. After updating this setting, you must trigger a new deployment using railway_service_deploy_latest to apply the changes.',
      inputSchema: {
        serviceId: serviceIdSchema,
        environmentId: environmentIdSchema,
        preDeployCommand: z
          .array(z.string().trim().min(1))
          .min(1, 'At least one pre-deploy command is required.')
          .describe('Commands to run before deployment.'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    async ({ serviceId, environmentId, preDeployCommand }) => {
      const railway = getRailway();
      const result = await railway.services.instances.update({
        variables: {
          serviceId,
          environmentId,
          input: {
            preDeployCommand,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const updateResult = unwrapField(
        result,
        'serviceInstanceUpdate',
        'Service instance not found or update failed.',
      );
      if (updateResult.isErr()) {
        return errorResponse(updateResult.error.message);
      }

      return successResponse({ success: updateResult.value });
    },
  );
};
