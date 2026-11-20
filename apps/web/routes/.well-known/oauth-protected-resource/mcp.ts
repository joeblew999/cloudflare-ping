// `/.well-known/oauth-protected-resource/mcp`: the protected resource metadata for /mcp (RFC
// 9728), which an MCP client reads first: the resource, and the authorization server that signs
// it in. From `mcp()` (auth.ts), which answers it from Better Auth's own request hook. In a Void
// app Better Auth sees only /api/auth, so this route hands the request on.
import { defineHandler } from "void";
import { getAuth } from "void/auth";

export const GET = defineHandler((c) => getAuth(c).handler(c.req.raw));
