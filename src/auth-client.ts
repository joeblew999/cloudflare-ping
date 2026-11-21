// Void's auth client (`createAuthClient` from void/client, Better Auth's) with the OAuth
// provider's client plugin, for the pages an MCP client's sign-in passes through (/login,
// /consent). The plugin adds the signed request in the page's query (`oauth_query`) to each POST,
// so signing in, or allowing, carries on with the agent's request. Better Auth's client then
// follows the answer's `{ redirect, url }` on its own. And the one-time token's, for /open
// (`cloudflare-ping open`, auth.ts).
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { oneTimeTokenClient } from "better-auth/client/plugins";
import { createAuthClient } from "void/client";

export const oauthAuth = createAuthClient({
  plugins: [oauthProviderClient(), oneTimeTokenClient()],
});
