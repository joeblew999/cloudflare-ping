// `GET /api/openapi.json`: the app's API as an OpenAPI 3.1 document (plan 2026-11-21-01, step 12):
// every command with an API route, what it takes, what it answers, how it fails, which need signing
// in. Made from the commands list and their output schemas (void-commands' `openApiOf`), so it
// says what the routes do. For other tools and SDK generators; the CLI and the pages use Void's
// typed fetch instead.
import { openApiOf } from "void-commands/server";
import { defineHandler } from "void";
import { API_VERSION } from "@cloudflare-ping/shared/version";
import { COMMANDS } from "../../src/commands/all";

export const GET = defineHandler((c) =>
  openApiOf({
    title: "cloudflare-ping",
    version: String(API_VERSION),
    server: new URL(c.req.url).origin,
    commands: COMMANDS,
  }),
);
