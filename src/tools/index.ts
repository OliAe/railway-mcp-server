import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerDeploymentTools } from './deployments.js';
import { registerDomainTools } from './domains.js';
import { registerEnvironmentTools } from './environments.js';
import { registerIntegrationTools } from './integrations.js';
import { registerNetworkingTools } from './networking.js';
import { registerObservabilityTools } from './observability.js';
import { registerProjectTools } from './projects.js';
import { registerServiceTools } from './services.js';
import { registerTemplateTools } from './templates.js';
import { registerVariableTools } from './variables.js';
import { registerVolumeTools } from './volumes.js';
import { registerWorkflowTools } from './workflows.js';

export const registerTools = (server: McpServer): void => {
  registerIntegrationTools(server); // Includes railway_verify_connection
  registerProjectTools(server);
  registerServiceTools(server);
  registerDeploymentTools(server);
  registerEnvironmentTools(server);
  registerVariableTools(server);
  registerTemplateTools(server);
  registerDomainTools(server);
  registerVolumeTools(server);
  registerObservabilityTools(server);
  registerNetworkingTools(server);
  registerWorkflowTools(server);
};
