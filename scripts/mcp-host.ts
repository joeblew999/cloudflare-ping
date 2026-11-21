// `vp run mcp:host` (plan 2026-11-21-02): an MCP Apps host on this machine that the agent can
// drive, so it can see a tool's app as a host shows it, without needing claude.ai. Its page
// (scripts/mcp-host/page.ts) is the official host pieces; this serves it on 127.0.0.1, and passes
// its MCP requests on to the app's /mcp, signed in as `mcp:check` is (scripts/mcp-sign-in.ts: the
// same registration and refresh token). The page never sees the token. The token has no `tests`
// scope, so nothing through here can spend tests, and the page calls only tools that only read.
// `vp run mcp:host`, then open http://127.0.0.1:8977/?tool=coverage&args={"place":"TH"}
// (`-- --site <url>` for another copy of the app, `--port` for another port).
import { createServer, type IncomingMessage } from "node:http";
import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { onePage } from "void-commands/vite";
import { SITE } from "@cloudflare-ping/shared/site";
import { accessToken, signedInClient, storedProvider } from "./mcp-sign-in";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: { site: { type: "string" }, port: { type: "string", default: "8977" } },
});
const site = values.site ?? `https://${SITE}`;
const port = Number(values.port);
const here = `http://127.0.0.1:${port}`;

// The kept sign-in, with nothing left connected; a full sign-in only when there's none yet.
const mcpUrl = new URL("/mcp", site);
let provider = await storedProvider(site);
if (!provider.tokens()) {
  const signed = await signedInClient(site, "cloudflare-ping mcp:host");
  await signed.client.close();
  provider = signed.provider;
}
const { html } = await onePage("scripts/mcp-host/page.ts", "mcp:host");

// What an MCP client sends that the server reads, and what comes back. Never the browser's
// Origin: the app refuses requests from other sites' pages, and this page is on 127.0.0.1.
const FORWARD = ["content-type", "accept", "mcp-protocol-version", "mcp-session-id"];
const BACK = ["content-type", "mcp-session-id", "mcp-protocol-version", "www-authenticate"];

// The request's body: MCP's messages are JSON text.
const bodyOf = (request: IncomingMessage) => text(request);

function onward(request: IncomingMessage, body: string, token: string) {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  for (const name of FORWARD) {
    const value = request.headers[name];
    if (typeof value === "string") {
      headers.set(name, value);
    }
  }
  const method = request.method ?? "GET";
  return fetch(mcpUrl, {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body }),
  });
}

const server = createServer((request, response) => {
  void (async () => {
    // Only this page, on this address: not another site's page in the same browser, and not a
    // name that only resolves here (DNS rebinding).
    const origin = request.headers.origin;
    if (request.headers.host !== `127.0.0.1:${port}` || (origin && origin !== here)) {
      response.writeHead(403).end("Only mcp:host's own page");
      return;
    }
    const at = new URL(request.url ?? "/", here);
    if (at.pathname === "/" && request.method === "GET") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }
    if (at.pathname !== "/mcp") {
      response.writeHead(404).end();
      return;
    }
    // The app's /mcp serves each POST on its own (routes/mcp.ts): no stream to hold open.
    if (request.method !== "POST") {
      response.writeHead(405, { allow: "POST" }).end();
      return;
    }
    const body = await bodyOf(request);
    let upstream = await onward(request, body, await accessToken(provider, mcpUrl));
    if (upstream.status === 401) {
      // Read to the end or closed: an answer left open stalls the connection under it.
      await upstream.body?.cancel();
      upstream = await onward(request, body, await accessToken(provider, mcpUrl, true));
    }
    const headers: Record<string, string> = {};
    for (const name of BACK) {
      const value = upstream.headers.get(name);
      if (value) {
        headers[name] = value;
      }
    }
    response.writeHead(upstream.status, headers);
    const reader = upstream.body?.getReader();
    try {
      for (let read = await reader?.read(); read && !read.done; read = await reader?.read()) {
        response.write(read.value);
      }
    } finally {
      response.end();
    }
  })().catch((caught: unknown) => {
    response.writeHead(502).end(caught instanceof Error ? caught.message : String(caught));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `mcp:host: ${site}'s MCP tools and apps at ${here}\n  e.g. ${here}/?tool=coverage&args={"place":"TH"}\n  Ctrl-C to stop.`,
  );
});
