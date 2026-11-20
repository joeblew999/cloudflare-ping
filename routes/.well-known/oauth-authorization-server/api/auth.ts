// `/.well-known/oauth-authorization-server/api/auth`: the authorization server's metadata (RFC
// 8414) at the issuer's path, /api/auth: where an MCP client registers, authorizes and gets
// tokens. From the OAuth provider under `mcp()` (auth.ts), handed on to Better Auth, which in a
// Void app sees only /api/auth.
import { defineHandler } from "void";
import { getAuth } from "void/auth";

export const GET = defineHandler((c) => getAuth(c).handler(c.req.raw));
