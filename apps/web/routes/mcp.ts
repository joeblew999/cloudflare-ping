// `POST /mcp`: the app's MCP server (src/mcp.ts), for any agent that speaks MCP over HTTP. Only
// POST: the SDK serves each request on its own, with no sessions to open or close.
// Signed in, for now, as the API is: the CLI's session token (`Authorization: Bearer …`). Plan
// 2026-11-20-01 step 3 replaces this with OAuth, so an agent signs itself in.
import { createMcpHandler, originValidationResponse } from "@modelcontextprotocol/server";
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { SITE } from "@cloudflare-ping/shared/site";
import { contextOf } from "../src/commands/context";
import { mcpServer } from "../src/mcp";

export const POST = defineHandler(async (c) => {
  // An MCP client isn't a browser: a request a web page on another site sends is refused.
  const refused = originValidationResponse(c.req.raw, [SITE, "localhost"]);
  if (refused) {
    return refused;
  }
  requireAuth(c);
  const context = contextOf(c);
  return createMcpHandler(() => mcpServer(context)).fetch(c.req.raw);
});
