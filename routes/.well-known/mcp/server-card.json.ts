// `GET /.well-known/mcp/server-card.json`: the MCP Server Card (plan 2026-11-21-01, step 12): what
// this MCP server is and where, for a client, registry or crawler, before it connects. From MCP's
// SEP-2127 ("MCP Server Cards"), still a proposal when checked on 2026-11-21
// (https://modelcontextprotocol.io/seps/2127-mcp-server-cards.md): its path and fields may change.
// What the server can do is found once connected (the SDK answers `server/discover` and lists).
import { defineHandler } from "void";
import { API_VERSION } from "@cloudflare-ping/shared/version";

export const GET = defineHandler((c) => {
  const origin = new URL(c.req.url).origin;
  c.header("access-control-allow-origin", "*");
  c.header("cache-control", "public, max-age=3600");
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "io.github.joeblew999/cloudflare-ping",
    title: "cloudflare-ping",
    description:
      "Probes from around the world, run from Cloudflare's data centres: start tests, runs and maps, read them, and see how many tests are left.",
    version: String(API_VERSION),
    websiteUrl: `${origin}/docs/agents`,
    remotes: [
      {
        type: "streamable-http",
        url: `${origin}/mcp`,
        supportedProtocolVersions: ["2026-07-28", "2025-11-25"],
      },
    ],
  };
});
