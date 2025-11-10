import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapArray, unwrapField } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
  .describe('The ID of the project.');

export const registerProjectTools = (server: McpServer): void => {
  server.registerTool(
    'railway_projects_list',
    {
      title: 'List Projects',
      description: 'Gets all projects for a user or workspace.',
      inputSchema: {
        userId: z.string().min(1).describe('Filter projects by user ID.').optional(),
        workspaceId: z.string().min(1).describe('Filter projects by workspace ID.').optional(),
        includeDeleted: z.boolean().describe('Include deleted projects.').optional(),
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
        projects: z.object({
          __typename: z.string().optional(),
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                createdAt: z.string(),
                updatedAt: z.string(),
                isPublic: z.boolean(),
                isTempProject: z.boolean(),
                teamId: z.string().nullable(),
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
    async ({ userId, workspaceId, includeDeleted, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.projects.list({
        variables: {
          userId: userId ?? null,
          workspaceId: workspaceId ?? null,
          includeDeleted: includeDeleted ?? null,
          first: first ?? null,
          after: after ?? null,
          last: last ?? null,
          before: before ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const projectsResult = unwrapField(
        result,
        'projects',
        'Invalid response from Railway: projects not found.',
      );
      if (projectsResult.isErr()) {
        return errorResponse(projectsResult.error.message);
      }

      return successResponse({ projects: projectsResult.value });
    },
  );

  server.registerTool(
    'railway_project_create',
    {
      title: 'Create Project',
      description: 'Create a new Railway project.',
      inputSchema: {
        name: z
          .string()
          .trim()
          .min(1, 'Project name is required')
          .describe('Name for the project.'),
        workspaceId: z
          .string()
          .trim()
          .min(1)
          .describe('Workspace ID to create the project in.')
          .optional(),
        description: z.string().trim().describe('Optional description for the project.').optional(),
        isPublic: z
          .boolean()
          .describe('If true, the project will be publicly accessible.')
          .optional(),
        prDeploys: z.boolean().describe('Enable pull request deployments by default.').optional(),
        defaultEnvironmentName: z
          .string()
          .trim()
          .min(1)
          .describe('Name for the initial environment (defaults to "production" if omitted).')
          .optional(),
      },
      outputSchema: {
        project: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          isPublic: z.boolean(),
          prDeploys: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
          baseEnvironmentId: z.string().nullable(),
          teamId: z.string().nullable(),
          botPrEnvironments: z.boolean(),
          deletedAt: z.string().nullable(),
          expiredAt: z.string().nullable(),
          isTempProject: z.boolean(),
          subscriptionType: z.string(),
          subscriptionPlanLimit: z.object({
            includedUsageDollars: z.number(),
            projects: z.number(),
            project: z.object({
              members: z.number().nullable(),
              services: z.number(),
              buckets: z.number(),
            }),
            volumes: z.object({
              defaultSizeMB: z.number(),
              maxSizeMB: z.number(),
              maxPerProject: z.number(),
              maxBackupsCount: z.number(),
              maxBackupsUsagePercent: z.number(),
            }),
            containers: z.object({
              cpu: z.number(),
              cpuDescription: z.string(),
              memoryBytes: z.number(),
              memoryDescription: z.string(),
              diskBytes: z.number(),
              diskDescription: z.string(),
              pidLimit: z.number(),
            }),
            builds: z.object({
              concurrent: z.number(),
              timeout: z.object({
                soft: z.number(),
                hard: z.number(),
              }),
              maxImageSizeBytes: z.number(),
            }),
            deploys: z.object({
              replicas: z.number(),
            }),
            observability: z.object({
              logRetentionDays: z.number(),
            }),
            networking: z.object({
              customDomains: z.number(),
              serviceDomains: z.number(),
            }),
            apiTokens: z.object({
              pointsToConsume: z.number(),
            }),
          }),
        }),
      },
    },
    async ({ name, workspaceId, description, isPublic, prDeploys, defaultEnvironmentName }) => {
      const railway = getRailway();
      const result = await railway.projects.create({
        variables: {
          input: {
            isMonorepo: false,
            repo: null,
            runtime: null,
            name,
            workspaceId: workspaceId ?? null,
            description: description ?? null,
            isPublic: isPublic ?? null,
            prDeploys: prDeploys ?? null,
            defaultEnvironmentName: defaultEnvironmentName ?? null,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const projectResult = unwrapField(result, 'projectCreate', 'Failed to create project.');
      if (projectResult.isErr()) {
        return errorResponse(projectResult.error.message);
      }

      return successResponse({ project: projectResult.value });
    },
  );

  server.registerTool(
    'railway_project_get',
    {
      title: 'Get Project',
      description: 'Retrieve high-level information about a project.',
      inputSchema: {
        projectId: projectIdSchema,
      },
      outputSchema: {
        project: z.object({
          __typename: z.string().optional(),
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          isPublic: z.boolean(),
          prDeploys: z.boolean(),
          createdAt: z.string(),
          updatedAt: z.string(),
          baseEnvironmentId: z.string().nullable(),
          teamId: z.string().nullable(),
          botPrEnvironments: z.boolean(),
          deletedAt: z.string().nullable(),
          expiredAt: z.string().nullable(),
          isTempProject: z.boolean(),
          subscriptionType: z.string(),
          subscriptionPlanLimit: z.object({
            includedUsageDollars: z.number(),
            projects: z.number(),
            project: z.object({
              members: z.number().nullable(),
              services: z.number(),
              buckets: z.number(),
            }),
            volumes: z.object({
              defaultSizeMB: z.number(),
              maxSizeMB: z.number(),
              maxPerProject: z.number(),
              maxBackupsCount: z.number(),
              maxBackupsUsagePercent: z.number(),
            }),
            containers: z.object({
              cpu: z.number(),
              cpuDescription: z.string(),
              memoryBytes: z.number(),
              memoryDescription: z.string(),
              diskBytes: z.number(),
              diskDescription: z.string(),
              pidLimit: z.number(),
            }),
            builds: z.object({
              concurrent: z.number(),
              timeout: z.object({
                soft: z.number(),
                hard: z.number(),
              }),
              maxImageSizeBytes: z.number(),
            }),
            deploys: z.object({
              replicas: z.number(),
            }),
            observability: z.object({
              logRetentionDays: z.number(),
            }),
            networking: z.object({
              customDomains: z.number(),
              serviceDomains: z.number(),
            }),
            apiTokens: z.object({
              pointsToConsume: z.number(),
            }),
          }),
        }),
      },
    },
    async ({ projectId }) => {
      const railway = getRailway();
      const result = await railway.projects.get({
        variables: {
          id: projectId,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const projectResult = unwrapField(result, 'project', 'Project not found.');
      if (projectResult.isErr()) {
        return errorResponse(projectResult.error.message);
      }

      return successResponse({ project: projectResult.value });
    },
  );

  server.registerTool(
    'railway_workspaces_list',
    {
      title: 'List Workspaces',
      description: 'List all workspaces the user can access.',
      inputSchema: {
        projectId: z
          .string()
          .min(1)
          .describe('Optional project ID to filter workspaces.')
          .optional(),
      },
      outputSchema: {
        workspaces: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string(),
            avatar: z.string().nullable(),
            createdAt: z.string(),
            plan: z.string(),
            preferredRegion: z.string().nullable(),
            teamId: z.string().nullable(),
            allowDeprecatedRegions: z.boolean().nullable(),
            customerState: z.string(),
            hasBAA: z.boolean(),
            isTrialing: z.boolean().nullable(),
          }),
        ),
      },
    },
    async ({ projectId }) => {
      const railway = getRailway();
      const result = await railway.workspaces.list({
        variables: {
          projectId: projectId ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const workspacesResult = unwrapArray(result, 'externalWorkspaces', 'Workspaces not found.');
      if (workspacesResult.isErr()) {
        return errorResponse(workspacesResult.error.message);
      }

      return successResponse({ workspaces: workspacesResult.value });
    },
  );
};
