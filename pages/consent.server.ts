// An MCP client's sign-in, second page (auth.ts, `mcp()`): Void's auth sends a signed-in visitor
// here with the agent's request, signed, in the query. Names the agent (its registration, by
// `client_id`) and what it asks for; pages/consent.tsx answers Allow or Deny.
import { defineHandler, defineHead, type InferProps } from "void";
import { getAuth, requireAuth } from "void/auth";
import { routeUrl } from "void/routes";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const url = new URL(c.req.url);
  // Signed out since (a session ended): sign in again, with the same signed request.
  const user = requireAuth(c, {
    throwRedirect: routeUrl("/login", { query: Object.fromEntries(url.searchParams) }),
  });
  const clientId = url.searchParams.get("client_id") ?? "";
  const client = await getAuth(c).api.getOAuthClientPublic({
    query: { client_id: clientId },
    headers: c.req.raw.headers,
  });
  return {
    email: user.email,
    agent: {
      name: client.client_name ?? clientId,
      uri: client.client_uri ?? null,
    },
    scopes: (url.searchParams.get("scope") ?? "").split(" ").filter((each) => each !== ""),
  };
});

export const head = defineHead<Props>((_c, props) => ({ title: `Allow ${props.agent.name}?` }));
