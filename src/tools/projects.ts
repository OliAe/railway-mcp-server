import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { unwrapField } from '@crisog/railway-sdk';
import { getRailway, getRailwayClient, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

// Fields every Railway Workspace still exposes. Kept explicit (rather than the
// SDK's generated selection) so a field Railway drops fails here, not silently.
const WORKSPACE_FIELDS =
  'id name avatar createdAt preferredRegion subscriptionModel banReason discordRole slackChannelId';

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  createdAt: z.string(),
  preferredRegion: z.string().nullable(),
  subscriptionModel: z.string(),
  banReason: z.string().nullable(),
  discordRole: z.string().nullable(),
  slackChannelId: z.string().nullable(),
});

type Workspace = z.infer<typeof workspaceSchema>;

// The SDK flattens `edges { node }` connections into arrays; accept either shape.
const extractNodes = <T>(connection: { edges: { node: T }[] } | T[] | null | undefined): T[] => {
  if (!connection) {
    return [];
  }
  if (Array.isArray(connection)) {
    return connection;
  }
  return connection.edges.map((edge) => edge.node);
};

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project.');

export const registerProjectTools = (server: McpServer): void => {
  server.registerTool(
    'railway_projects_list',
    {
      title: 'List Projects',
      description: 'Gets all projects for a user or workspace.',
      inputSchema: {
        userId: z
          .string()
          .uuid('User ID must be a valid UUID')
          .describe('Filter projects by user ID.')
          .optional(),
        workspaceId: z
          .string()
          .uuid('Workspace ID must be a valid UUID')
          .describe('Filter projects by workspace ID.')
          .optional(),
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
        projects: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            createdAt: z.string(),
            updatedAt: z.string(),
            isPublic: z.boolean(),
            isTempProject: z.boolean(),
            teamId: z.string().nullable(),
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
    async ({ userId, workspaceId, includeDeleted, first, after, last, before }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.projects.list({
        variables: {
          userId,
          workspaceId,
          includeDeleted,
          first,
          after,
          last,
          before,
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

      return successResponse({
        projects: projectsResult.value,
        pageInfo: projectsResult.value.pageInfo,
      });
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
          .uuid('Workspace ID must be a valid UUID')
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
          // Railway's plan-limit JSON changes shape with its plans (e.g. `buckets` moved
          // out of `project`), so pass it through rather than pin a stale shape.
          subscriptionPlanLimit: z.record(z.string(), z.unknown()),
        }),
      },
    },
    async ({ name, workspaceId, description, isPublic, prDeploys, defaultEnvironmentName }) => {
      const railway = getRailway();
      const result = await railway.projects.create({
        variables: {
          input: {
            name,
            workspaceId,
            description,
            isPublic,
            prDeploys,
            defaultEnvironmentName,
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
          // Railway's plan-limit JSON changes shape with its plans (e.g. `buckets` moved
          // out of `project`), so pass it through rather than pin a stale shape.
          subscriptionPlanLimit: z.record(z.string(), z.unknown()),
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
      description:
        'List the workspaces this token can see. Account tokens list every workspace the user ' +
        'belongs to; workspace tokens list the workspace they are scoped to.',
      inputSchema: {},
      outputSchema: {
        workspaces: z.array(workspaceSchema),
      },
    },
    async () => {
      const client = getRailwayClient();

      // Account tokens can read `me`. The SDK's generated MeDocument selects
      // Workspace.supportTierOverride, which Railway has removed, so every call
      // failed schema validation -- hence the hand-written selection here.
      const meResult = await client.request<{ me: { workspaces: Workspace[] | null } }>({
        query: `query workspacesForMe { me { workspaces { ${WORKSPACE_FIELDS} } } }`,
      });
      if (meResult.isOk()) {
        return successResponse({ workspaces: meResult.value.me?.workspaces ?? [] });
      }

      // Workspace (team) tokens are refused `me` with "Not Authorized". They can
      // still list projects, so resolve the distinct workspaces those belong to.
      const projectsResult = await client.request<{
        projects:
          | { edges: { node: { workspaceId: string | null } }[] }
          | { workspaceId: string | null }[];
      }>({
        query: 'query workspaceIdsFromProjects { projects { edges { node { workspaceId } } } }',
      });
      if (projectsResult.isErr()) {
        return errorResponse(toRailwayErrorMessage(meResult.error));
      }

      const workspaceIds = [
        ...new Set(
          extractNodes<{ workspaceId: string | null }>(projectsResult.value.projects)
            .map((project) => project.workspaceId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const workspaces: Workspace[] = [];
      for (const workspaceId of workspaceIds) {
        const workspaceResult = await client.request<{ workspace: Workspace }>({
          query: `query workspaceById($workspaceId: String!) { workspace(workspaceId: $workspaceId) { ${WORKSPACE_FIELDS} } }`,
          variables: { workspaceId },
        });
        if (workspaceResult.isErr()) {
          return errorResponse(toRailwayErrorMessage(workspaceResult.error));
        }
        workspaces.push(workspaceResult.value.workspace);
      }

      return successResponse({ workspaces });
    },
  );
};
