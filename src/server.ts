import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GraphQLRequestError, MissingTokenError } from '@crisog/railway-sdk';

import { getPackageVersion } from './utils.js';
import { registerTools } from './tools/index.js';

export const createServer = (): McpServer => {
  const server = new McpServer(
    {
      name: 'railway-mcp-server',
      title: 'Unofficial Railway MCP Server',
      version: getPackageVersion(),
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  registerTools(server);

  return server;
};

export const startServer = async (): Promise<void> => {
  const server = createServer();
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
  } catch (error) {
    if (error instanceof GraphQLRequestError || error instanceof MissingTokenError) {
      console.error(error.message);
    } else {
      console.error('Failed to start MCP server:', error);
    }
    process.exit(1);
  }
};
