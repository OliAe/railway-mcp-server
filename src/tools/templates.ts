import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

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
        templates: z.unknown(),
      },
    },
    async ({ first, last, after, before, recommended }) => {
      if (first !== undefined && last !== undefined) {
        return errorResponse('Provide either first or last, not both.');
      }

      try {
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

        return successResponse({ templates: result.templates });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
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

      try {
        const railway = getRailway();
        const result = await railway.templates.get({
          variables: {
            code: code ?? null,
            owner: owner ?? null,
            repo: repo ?? null,
          },
        });

        if (!result.template) {
          return errorResponse('Template not found.');
        }

        return successResponse({ template: result.template });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );

  server.registerTool(
    'railway_template_deploy',
    {
      title: 'Deploy Template',
      description:
        'Deploy a template into a project or workspace. Provide templateId and serializedConfig, or identify the template to resolve them automatically.',
      inputSchema: {
        templateId: z.string().trim().min(1).describe('ID of the template to deploy.').optional(),
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
          .min(1)
          .describe('Project ID to deploy into. Provide this or a workspaceId.')
          .optional(),
        environmentId: z
          .string()
          .trim()
          .min(1)
          .describe('Optional environment ID to target.')
          .optional(),
        workspaceId: z
          .string()
          .trim()
          .min(1)
          .describe('Workspace ID when creating a project from the template.')
          .optional(),
      },
      outputSchema: {
        deployment: z.object({
          projectId: z.string(),
          workflowId: z.string().nullable(),
        }),
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

      try {
        const railway = getRailway();

        let resolvedTemplateId = templateId?.trim() ?? null;
        let resolvedConfig = serializedConfig ?? null;

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

          const template = lookup.template;
          if (!template) {
            return errorResponse('Template not found.');
          }

          if (!resolvedTemplateId) {
            resolvedTemplateId = template.id;
          }

          if (resolvedConfig === null || resolvedConfig === undefined) {
            resolvedConfig = template.serializedConfig;
          }
        }

        if (!resolvedTemplateId) {
          return errorResponse(
            'Unable to resolve template ID. Provide templateId or template code.',
          );
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

        return successResponse({ deployment: result.templateDeployV2 });
      } catch (error) {
        return errorResponse(toRailwayErrorMessage(error));
      }
    },
  );
};
