// `/.well-known/oauth-protected-resource`: the same as ./mcp.ts, for clients that ask without the
// resource's path. From `mcp()` (auth.ts), handed on to Better Auth, which in a Void app sees
// only /api/auth.
import { defineHandler } from "void";
import { getAuth } from "void/auth";

export const GET = defineHandler((c) => getAuth(c).handler(c.req.raw));
