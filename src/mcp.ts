// The app's MCP server (plan 2026-11-21-01): every command with an MCP tool, made from the commands
// list (packages/shared/src/commands.ts) and their code (src/commands) by void-commands. Each tool
// takes the same input as its API route (the same schema), answers what its output schema says,
// and runs the same code; `show` and `map` are resources too. Served by routes/mcp.ts, a fresh
// server per request (the SDK's `createMcpHandler`): nothing is kept between requests but the
// same-call answers in KV.
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { commandsMcpServer, type McpCaller } from "void-commands/server";
import { kv } from "void/kv";
import { API_VERSION } from "@cloudflare-ping/shared/version";
import { COMMANDS } from "./commands/all";
import { logCall, type CommandContext } from "./commands/context";
import { limits } from "./commands/limits";
import { SPEND_SCOPE } from "./mcp-scope";

// The same call to a tool that spends, twice within two minutes: answered once (step 8).
const SAME_CALL_SECONDS = 120;

export function mcpServer(context: CommandContext, caller: McpCaller) {
  return commandsMcpServer({
    info: {
      name: "cloudflare-ping",
      version: String(API_VERSION),
      title: "cloudflare-ping",
      instructions:
        "Probes from around the world, run from Cloudflare's data centres. Starting a run, a test or a map spends Globalping tests: check limits first. Places finds what to pass as from.",
    },
    commands: COMMANDS,
    context,
    caller,
    spendScope: SPEND_SCOPE,
    spending: "Globalping tests (check limits first)",
    sameCall: {
      seconds: SAME_CALL_SECONDS,
      store: {
        get: (key) => kv.get(key),
        put: (key, value) => kv.put(key, value, { ttl: SAME_CALL_SECONDS }),
      },
    },
    // Before spending, when the client can ask its user: how many are left right now.
    askBeforeSpending: async (definition) => {
      const left = await limits.run({}, context).catch(() => null);
      const count = left
        ? `${left.globalping.remaining} of ${left.globalping.limit} are left this hour`
        : "how many are left couldn't be read";
      return `${definition.name} spends Globalping tests: ${count}. Go ahead?`;
    },
    log: logCall,
    // Workers can't compile code at runtime, which the SDK's default JSON Schema checker does.
    serverOptions: { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  });
}
