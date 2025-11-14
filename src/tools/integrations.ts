import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField, unwrapArray } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .uuid('Project ID must be a valid UUID')
  .describe('The ID of the project.');

export const registerIntegrationTools = (server: McpServer): void => {
  server.registerTool(
    'railway_github_repos_list',
    {
      title: 'List GitHub Repositories',
      description: 'List all accessible GitHub repositories for the authenticated user.',
      outputSchema: {
        repos: z.array(
          z.object({
            __typename: z.string().optional(),
            id: z.number(),
            name: z.string(),
            fullName: z.string(),
            defaultBranch: z.string(),
            isPrivate: z.boolean(),
            installationId: z.string(),
          }),
        ),
        __typename: z.string().optional(),
      },
    },
    async () => {
      const railway = getRailway();
      const result = await railway.integrations.github.listRepos();

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const reposResult = unwrapArray(
        result,
        'githubRepos',
        'Invalid response from Railway: expected array of repositories.',
      );
      if (reposResult.isErr()) {
        return errorResponse(reposResult.error.message);
      }

      return successResponse({ repos: reposResult.value });
    },
  );

  server.registerTool(
    'railway_github_branches_list',
    {
      title: 'List GitHub Branches',
      description: 'List all branches for a GitHub repository.',
      inputSchema: {
        owner: z
          .string()
          .min(1, 'Repository owner is required')
          .describe('The GitHub repository owner.'),
        repo: z
          .string()
          .min(1, 'Repository name is required')
          .describe('The GitHub repository name.'),
      },
      outputSchema: {
        branches: z.array(
          z.object({
            name: z.string(),
            __typename: z.string().optional(),
          }),
        ),
        __typename: z.string().optional(),
      },
    },
    async ({ owner, repo }) => {
      const railway = getRailway();
      const result = await railway.integrations.github.listBranches({
        variables: {
          owner,
          repo,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const branchesResult = unwrapArray(
        result,
        'githubRepoBranches',
        'Invalid response from Railway: expected array of branches.',
      );
      if (branchesResult.isErr()) {
        return errorResponse(branchesResult.error.message);
      }

      return successResponse({ branches: branchesResult.value });
    },
  );

  server.registerTool(
    'railway_github_repo_deploy',
    {
      title: 'Deploy from GitHub Repository',
      description: 'Deploy a GitHub repository to a Railway project.',
      inputSchema: {
        projectId: projectIdSchema,
        repo: z
          .string()
          .min(1, 'Repository is required')
          .describe('The full GitHub repository name (e.g., "owner/repo").'),
        branch: z.string().trim().describe('The branch to deploy from.').optional(),
      },
      outputSchema: {
        projectId: z.string(),
      },
    },
    async ({ projectId, repo, branch }) => {
      const railway = getRailway();
      const result = await railway.integrations.github.deployRepo({
        variables: {
          input: {
            projectId,
            repo,
            branch,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const projectIdResult = unwrapField(
        result,
        'githubRepoDeploy',
        'Failed to deploy repository.',
      );
      if (projectIdResult.isErr()) {
        return errorResponse(projectIdResult.error.message);
      }

      return successResponse({ projectId: projectIdResult.value });
    },
  );
};
