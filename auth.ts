// Who may use what spends Globalping tests (plan step 6): Void's auth (Better Auth), with Better
// Auth's own plugins. Only the addresses in ALLOWED_EMAILS (env.ts) can make an account, however
// they sign in.
// - Device login: the CLI signs in once per machine, approved in the browser
//   (packages/cli/sign-in.ts, pages/device.tsx). Bearer: the CLI's token is read from its
//   Authorization header.
// - MCP (plan 2026-11-20-01, step 3): Void's auth is also the OAuth server any MCP client signs in
//   through. `mcp()` (Better Auth's MCP plugin, on its OAuth provider) issues tokens bound to
//   `/mcp` only, signed by `jwt()`. A client registers itself by its metadata URL (`cimd()`,
//   which MCP 2026-07-28 asks for) or by Dynamic Client Registration (most clients today). Anyone
//   can register a client, but only an allowed account can sign one in. Signing in is /login, then
//   /consent.
import { cimd } from "@better-auth/cimd";
import { mcp } from "@better-auth/mcp";
import { APIError } from "better-auth/api";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { jwt } from "better-auth/plugins/jwt";
import { defineAuth } from "void/auth";
import { CLI_CLIENT_ID, SITE } from "@cloudflare-ping/shared/site";

// CIMD fetches a client's metadata document from the URL it names. Its own transport is for Node
// (`node:net`, to refuse private addresses). On a Worker, `fetch` already only reaches public
// URLs: never a raw IP address, a private network or localhost (Cloudflare's docs: Workers,
// "Fetch to IP addresses"; TCP sockets, "disallowed address"). Redirects are refused, as CIMD
// asks.
const fetchClientMetadataResource = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, redirect: "manual" });

export default defineAuth(({ defaults, env }) => {
  const list = typeof env.ALLOWED_EMAILS === "string" ? env.ALLOWED_EMAILS : "";
  const allowed = new Set(
    list
      .split(",")
      .map((each) => each.trim().toLowerCase())
      .filter((each) => each !== ""),
  );
  // Void makes the auth for each request, its base URL the request's origin: the deployed site,
  // or `vp dev`'s localhost.
  const origin = typeof defaults.baseURL === "string" ? defaults.baseURL : `https://${SITE}`;
  return {
    ...defaults,
    plugins: [
      ...(defaults.plugins ?? []),
      bearer(),
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
      jwt(),
      mcp({
        resource: `${origin}/mcp`,
        loginPage: "/login",
        consentPage: "/consent",
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Native clients (Claude Code, Cursor) call back to http://127.0.0.1 and may not say
        // they're native.
        clientRegistrationDefaultApplicationType: "infer",
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    ],
    databaseHooks: {
      user: {
        create: {
          // Refused in words the page shows (Better Auth's own would be "Failed to create user").
          // Not a 403, which Better Auth answers with a generic reply instead.
          before: async (user) => {
            if (!allowed.has(user.email.toLowerCase())) {
              throw new APIError("BAD_REQUEST", {
                message: "Only the addresses this app allows can make an account.",
              });
            }
            return { data: user };
          },
        },
      },
    },
  };
});
