// The app's MCP tools (plan 2026-11-20-01): one for each command in packages/shared/src/commands.ts
// that has one, named and described as `cloudflare-ping help` names and describes it, taking the
// same input as its API route (the same zod schema) and running the same command
// (src/commands). Served by routes/mcp.ts, a fresh server per request (the SDK's
// `createMcpHandler`): nothing is kept between requests.
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { COMMAND_LIST } from "@cloudflare-ping/shared/commands";
import { API_VERSION } from "@cloudflare-ping/shared/version";
import type { CommandContext } from "./commands/context";
import { coverage, coverageQuery } from "./commands/coverage";
import { limits } from "./commands/limits";
import { map, mapQuery, remap, remapInput } from "./commands/map";
import { places, placesQuery } from "./commands/places";
import { input as runInput, run } from "./commands/run";
import { runs, show, showParams } from "./commands/runs";
import { input as testInput, test } from "./commands/test";
import { trace, traceInput } from "./commands/trace";

// The tool's description: the command's own words, and where the web and the terminal do the same.
function describe(tool: string) {
  const command = COMMAND_LIST.find((each) => each.tool === tool);
  if (!command) {
    throw new Error(`No command has the tool ${tool} (packages/shared/src/commands.ts)`);
  }
  return `${command.about}. The same as \`cloudflare-ping ${command.use}\`, ${command.api}, and the page ${command.page}.`;
}

// A command's answer as a tool's: its JSON, as data and as text. A failure is the tool's error,
// in the words the page and the CLI show.
async function answer(work: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const result = await work();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (caught) {
    return {
      isError: true,
      content: [{ type: "text", text: caught instanceof Error ? caught.message : String(caught) }],
    };
  }
}

// Spends a Globalping test: neither read-only nor harmful, and it reaches the internet.
const spends = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
const reads = { readOnlyHint: true, openWorldHint: false };

export function mcpServer(context: CommandContext) {
  const server = new McpServer(
    { name: "cloudflare-ping", version: String(API_VERSION) },
    // Workers can't compile code at runtime, which the SDK's default JSON Schema checker does.
    { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );
  server.registerTool(
    "test",
    { description: describe("test"), inputSchema: testInput, annotations: spends },
    (body) => answer(() => test(body)),
  );
  server.registerTool(
    "run",
    { description: describe("run"), inputSchema: runInput, annotations: spends },
    (body) => answer(() => run(body, context)),
  );
  server.registerTool("runs", { description: describe("runs"), annotations: reads }, () =>
    answer(runs),
  );
  server.registerTool(
    "show",
    { description: describe("show"), inputSchema: showParams, annotations: reads },
    (params) => answer(() => show(params)),
  );
  server.registerTool(
    "limits",
    { description: describe("limits"), annotations: { readOnlyHint: true, openWorldHint: true } },
    () => answer(() => limits(context)),
  );
  server.registerTool(
    "coverage",
    {
      // Without its ~1,100 probe cities unless asked: the totals, regions and data centres answer
      // most questions.
      description: `${describe("coverage")} Pass country (a code, as places gives it: TH) for one country; cities: true for every probe city too.`,
      inputSchema: coverageQuery,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    // Everything the agent asked (its country too), with the cities only when asked.
    (query) => answer(() => coverage({ ...query, cities: query.cities ?? false })),
  );
  server.registerTool(
    "places",
    {
      // At most 50 unless asked: an agent wants the best few, not all ~3,000.
      description: `${describe("places")} At most 50, best first, unless limit is given.`,
      inputSchema: placesQuery,
      annotations: reads,
    },
    (query) => answer(() => places({ ...query, limit: query.limit ?? 50 })),
  );
  server.registerTool(
    "map",
    { description: describe("map"), inputSchema: mapQuery, annotations: reads },
    (query) => answer(() => map(query)),
  );
  server.registerTool(
    "remap",
    { description: describe("remap"), inputSchema: remapInput, annotations: spends },
    (body) => answer(() => remap(body)),
  );
  server.registerTool(
    "trace",
    { description: describe("trace"), inputSchema: traceInput, annotations: reads },
    (params) => answer(() => trace(params)),
  );
  return server;
}
