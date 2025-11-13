import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { unwrapField } from '@crisog/railway-sdk';
import { getRailway, toRailwayErrorMessage } from '../client.js';
import { errorResponse, successResponse } from './responses.js';

const ensureTemplateIdentifier = (params: {
  code?: string;
  owner?: string;
  repo?: string;
  templateId?: string;
}): { valid: boolean; message?: string } => {
  const hasCode = Boolean(params.code && params.code.trim());
  const hasOwner = Boolean(params.owner && params.owner.trim());
  const hasRepo = Boolean(params.repo && params.repo.trim());
  const hasTemplateId = Boolean(params.templateId && params.templateId.trim());

  if (hasOwner !== hasRepo) {
    return { valid: false, message: 'Provide both owner and repo together.' };
  }

  if (!hasTemplateId && !hasCode && !(hasOwner && hasRepo)) {
    return { valid: false, message: 'Provide templateId, template code, or owner and repo.' };
  }

  return { valid: true };
};

export const registerTemplateTools = (server: McpServer): void => {
  server.registerTool(
    'railway_templates_list',
    {
      title: 'List Templates',
      description:
        'List available templates. Results can be paginated or filtered by recommendation.',
      inputSchema: {
        first: z
          .number()
          .int()
          .positive()
          .max(100)
          .describe('Maximum number of templates to return.')
          .optional(),
        last: z
          .number()
          .int()
          .positive()
          .max(100)
          .describe('Fetch templates in reverse order (use with before).')
          .optional(),
        after: z.string().describe('Cursor for the next page.').optional(),
        before: z.string().describe('Cursor for the previous page.').optional(),
        recommended: z.boolean().describe('Only include recommended templates.').optional(),
      },
      outputSchema: {
        templates: z.object({
          __typename: z.string().optional(),
          edges: z.array(
            z.object({
              cursor: z.string(),
              node: z.object({
                __typename: z.string().optional(),
                id: z.string(),
                code: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                category: z.string(),
                image: z.string().nullable(),
                activeProjects: z.number(),
                health: z.number().nullable(),
                isApproved: z.boolean(),
                isV2Template: z.boolean(),
                createdAt: z.string(),
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
    async ({ first, last, after, before, recommended }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      const railway = getRailway();
      const result = await railway.templates.list({
        variables: {
          first: first ?? null,
          last: last ?? null,
          after: after ?? null,
          before: before ?? null,
          recommended: recommended ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const templatesResult = unwrapField(result, 'templates', 'Failed to list templates.');
      if (templatesResult.isErr()) {
        return errorResponse(templatesResult.error.message);
      }

      return successResponse({ templates: templatesResult.value });
    },
  );

  server.registerTool(
    'railway_template_get',
    {
      title: 'Get Template',
      description: 'Fetch detailed information for a template by code or GitHub owner/repo.',
      inputSchema: {
        code: z.string().trim().min(1).describe('Template code (slug).').optional(),
        owner: z.string().trim().min(1).describe('GitHub owner for the template.').optional(),
        repo: z.string().trim().min(1).describe('GitHub repo for the template.').optional(),
      },
      outputSchema: {
        template: z.unknown(),
      },
    },
    async ({ code, owner, repo }) => {
      const identifierCheck = ensureTemplateIdentifier({ code, owner, repo });
      if (!identifierCheck.valid) {
        return errorResponse(identifierCheck.message ?? 'Invalid template identifier.');
      }

      const railway = getRailway();
      const result = await railway.templates.get({
        variables: {
          code: code ?? null,
          owner: owner ?? null,
          repo: repo ?? null,
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const templateResult = unwrapField(result, 'template', 'Template not found.');
      if (templateResult.isErr()) {
        return errorResponse(templateResult.error.message);
      }

      return successResponse({ template: templateResult.value });
    },
  );

  server.registerTool(
    'railway_template_deploy',
    {
      title: 'Deploy Template',
      description:
        'Deploy a template into a project or workspace. Provide templateId and serializedConfig, or identify the template to resolve them automatically.',
      inputSchema: {
        templateId: z
          .string()
          .trim()
          .uuid('Template ID must be a valid UUID')
          .describe('ID of the template to deploy.')
          .optional(),
        code: z.string().trim().min(1).describe('Template code (slug).').optional(),
        owner: z.string().trim().min(1).describe('GitHub owner for the template.').optional(),
        repo: z.string().trim().min(1).describe('GitHub repo for the template.').optional(),
        serializedConfig: z
          .unknown()
          .describe('Serialized template configuration payload.')
          .optional(),
        projectId: z
          .string()
          .trim()
          .uuid('Project ID must be a valid UUID')
          .describe('Project ID to deploy into. Provide this or a workspaceId.')
          .optional(),
        environmentId: z
          .string()
          .trim()
          .uuid('Environment ID must be a valid UUID')
          .describe('Optional environment ID to target.')
          .optional(),
        workspaceId: z
          .string()
          .trim()
          .uuid('Workspace ID must be a valid UUID')
          .describe('Workspace ID when creating a project from the template.')
          .optional(),
      },
      outputSchema: {
        deployment: z.object({
          __typename: z.string().optional(),
          projectId: z.string(),
          workflowId: z.string().nullable(),
        }),
        workflow: z
          .object({
            status: z.string(),
            error: z.string().nullable(),
            __typename: z.string().optional(),
          })
          .optional(),
        __typename: z.string().optional(),
      },
    },
    async ({
      templateId,
      code,
      owner,
      repo,
      serializedConfig,
      projectId,
      environmentId,
      workspaceId,
    }) => {
      const identifierCheck = ensureTemplateIdentifier({ code, owner, repo, templateId });
      if (!identifierCheck.valid) {
        return errorResponse(identifierCheck.message ?? 'Invalid template identifier.');
      }

      if (!projectId && !workspaceId) {
        return errorResponse('Provide a projectId or workspaceId for the deployment target.');
      }

      if (projectId && !environmentId) {
        return errorResponse('environmentId is required when deploying into an existing project.');
      }

      const railway = getRailway();

      let resolvedTemplateId = templateId?.trim() ?? null;
      let resolvedConfig: unknown = serializedConfig ?? null;

      const canLookup = Boolean(code?.trim() || (owner?.trim() && repo?.trim()));
      const needsLookup =
        (!resolvedTemplateId || resolvedConfig === null || resolvedConfig === undefined) &&
        canLookup;

      if (needsLookup) {
        const lookup = await railway.templates.get({
          variables: {
            code: code ?? null,
            owner: owner ?? null,
            repo: repo ?? null,
          },
        });

        if (lookup.isErr()) {
          return errorResponse(toRailwayErrorMessage(lookup.error));
        }

        const templateResult = unwrapField(lookup, 'template', 'Template not found.');
        if (templateResult.isErr()) {
          return errorResponse(templateResult.error.message);
        }

        const template = templateResult.value as { id: string; serializedConfig: unknown };

        if (!resolvedTemplateId) {
          resolvedTemplateId = template.id;
        }

        if (resolvedConfig === null || resolvedConfig === undefined) {
          resolvedConfig = template.serializedConfig;
        }
      }

      if (!resolvedTemplateId) {
        return errorResponse('Unable to resolve template ID. Provide templateId or template code.');
      }

      if (resolvedConfig === null || resolvedConfig === undefined) {
        return errorResponse(
          'Unable to resolve serialized template config. Provide serializedConfig or identify the template.',
        );
      }

      const result = await railway.templates.deploy({
        variables: {
          input: {
            templateId: resolvedTemplateId,
            serializedConfig: resolvedConfig,
            projectId: projectId ?? null,
            environmentId: environmentId ?? null,
            workspaceId: workspaceId ?? null,
          },
        },
      });

      if (result.isErr()) {
        return errorResponse(toRailwayErrorMessage(result.error));
      }

      const deploymentResult = unwrapField(
        result,
        'templateDeployV2',
        'Railway did not return deployment details.',
      );
      if (deploymentResult.isErr()) {
        return errorResponse(deploymentResult.error.message);
      }

      const deployment = deploymentResult.value as {
        projectId: string;
        workflowId: string | null;
        __typename?: string;
      };

      const deploymentResponse = {
        projectId: deployment.projectId,
        workflowId: deployment.workflowId,
        ...(deployment.__typename ? { __typename: deployment.__typename } : {}),
      };

      let workflowStatusResult:
        | { status: string; error: string | null; __typename?: string }
        | undefined;

      if (deployment.workflowId) {
        const status = await railway.projects.workflows.status({
          variables: { workflowId: deployment.workflowId },
        });

        if (status.isErr()) {
          workflowStatusResult = {
            status: 'UNKNOWN',
            error: status.error.message,
          };
        } else {
          const workflowStatusField = unwrapField(
            status,
            'workflowStatus',
            'Workflow status not found.',
          );
          if (workflowStatusField.isOk()) {
            const workflowStatus = workflowStatusField.value as {
              status: string;
              error: string | null;
              __typename?: string;
            };
            workflowStatusResult = {
              status: workflowStatus.status,
              error: workflowStatus.error ?? null,
              ...(workflowStatus.__typename ? { __typename: workflowStatus.__typename } : {}),
            };
          }
        }
      }

      return successResponse(
        workflowStatusResult
          ? { deployment: deploymentResponse, workflow: workflowStatusResult }
          : { deployment: deploymentResponse },
      );
    },
  );
};
