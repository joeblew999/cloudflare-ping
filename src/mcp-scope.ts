// The OAuth scope an MCP token needs for the tools that spend Globalping tests (plan 2026-11-21-01,
// step 6): auth.ts gives it out, src/mcp.ts asks for it, the consent page says what it means. On
// its own so auth.ts doesn't load the MCP server.
export const SPEND_SCOPE = "tests";
