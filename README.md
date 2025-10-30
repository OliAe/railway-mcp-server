# @crisog/railway-mcp-server

Railway's Model Context Protocol (MCP) server for exposing Railway resources and automation tools to MCP-compatible clients.

## Installation

Install the package from npm:

```bash
npm install --save-dev @crisog/railway-mcp-server
```

or install it globally to make the CLI available everywhere:

```bash
npm install --global @crisog/railway-mcp-server
```

> **Node.js 20.19+ is required** because the build and runtime depend on tsdown and modern ESM features.

## Building from source

Install dependencies and generate the compiled output with:

```bash
bun install
bun run build
```

The compiled JavaScript, type declarations, and CLI entry point are emitted to `dist/`.

For iterative development you can use watch mode:

```bash
bun run dev
```

## Usage

Set your Railway token in the environment (`RAILWAY_TOKEN` or the variable required by `@crisog/railway-sdk`) and start the server:

```bash
railway-mcp-server
```

The CLI will start the MCP server over stdio so your MCP client can communicate with Railway.

## Publishing

Before publishing, run:

```bash
bun run build
npm pack
```

This ensures the `dist/` directory is fresh and the packaged contents look correct.
