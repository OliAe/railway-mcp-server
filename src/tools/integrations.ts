import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const projectIdSchema = z
  .string()
  .min(1, 'Project ID is required')
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
            id: z.number(),
            name: z.string(),
            fullName: z.string(),
            defaultBranch: z.string(),
            isPrivate: z.boolean(),
            installationId: z.string(),
          }),
        ),
      },
    },
    async () => {
      try {
        const railway = getRailway();
        const result = await railway.integrations.github.listRepos();

        return successResponse({ repos: result.githubRepos });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
          }),
        ),
      },
    },
    async ({ owner, repo }) => {
      try {
        const railway = getRailway();
        const result = await railway.integrations.github.listBranches({
          variables: {
            owner,
            repo,
          },
        });

        return successResponse({ branches: result.githubRepoBranches });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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
      try {
        const railway = getRailway();
        const result = await railway.integrations.github.deployRepo({
          variables: {
            input: {
              projectId,
              repo,
              branch: branch ?? null,
            },
          },
        });

        return successResponse({ projectId: result.githubRepoDeploy });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
