import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GraphQLRequestError, MissingTokenError } from 'railway-sdk';

import { registerTools } from './tools/index.js';

export const createServer = (): McpServer => {
  const server = new McpServer({
    name: 'railway-mcp',
    version: '0.1.0',
  });

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
