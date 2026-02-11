#!/usr/bin/env node

/**
 * GSD MCP Server
 *
 * Generic MCP server that exposes GSD workflows as tools.
 * Compatible with any MCP client (Claude Desktop, Cursor, Windsurf, Zed, etc.)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

// Server info - sync with parent package.json version
const serverInfo = {
  name: "gsd-mcp-server",
  version: "1.18.0",
};

// Server capabilities
const serverCapabilities = {
  tools: {},
  resources: {},
  prompts: {},
};

// Create server with simplified initialization
const server = new Server(serverInfo, {
  capabilities: serverCapabilities
});

// Register all handlers
registerTools(server);
registerResources(server);
registerPrompts(server);

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol)
  console.error("GSD MCP Server started");
  console.error("Waiting for client connection...");

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      console.error("Server closed.");
    } catch (error) {
      console.error("Error during shutdown:", error);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
