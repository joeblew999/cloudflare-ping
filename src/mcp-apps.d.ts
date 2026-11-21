// An MCP App's page, built into one HTML string (void-commands/vite's `mcpApps`, from
// src/apps/<name>.tsx), for src/mcp.ts to hand the MCP server.
declare module "virtual:mcp-app/*" {
  const html: string;
  export default html;
}
