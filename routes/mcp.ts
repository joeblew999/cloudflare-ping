// `POST /mcp`: the app's MCP server (src/mcp.ts), for any agent that speaks MCP over HTTP. Only
// POST: the SDK serves each request on its own, with no sessions to open or close.
// Signed in by OAuth through Void's auth (auth.ts, `mcp()`): `requireMcpAuth` takes only an access
// token issued for this resource (signed by `jwt()`, for an allowed account). Without one it
// answers 401, with a `WWW-Authenticate` naming /.well-known/oauth-protected-resource/mcp, which
// is how an agent finds where to sign in.
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler, originValidationResponse } from "@modelcontextprotocol/server";
import { defineHandler } from "void";
import { getAuth } from "void/auth";
import { logger } from "void/log";
import { SITE } from "@cloudflare-ping/shared/site";
import { contextOf } from "../src/commands/context";
import { mcpServer } from "../src/mcp";

export const POST = defineHandler(async (c) => {
  // An MCP client isn't a browser: a request a web page on another site sends is refused.
  const refused = originValidationResponse(c.req.raw, [SITE, "localhost"]);
  if (refused) {
    return refused;
  }
  const context = contextOf(c);
  const serve = requireMcpAuth(
    getAuth(c),
    (request, claims) => {
      const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
      logger.info("MCP request", { client: claims.azp ?? null, user: claims.sub ?? null });
      return createMcpHandler(() => mcpServer(context)).fetch(request, {
        authInfo: {
          token: request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "",
          clientId: typeof claims.azp === "string" ? claims.azp : "",
          scopes,
          ...(claims.exp ? { expiresAt: claims.exp } : {}),
        },
      });
    },
    // The same resource auth.ts gives `mcp()`: this request's origin, then /mcp.
    { resource: `${new URL(c.req.url).origin}/mcp` },
  );
  return serve(c.req.raw);
});
