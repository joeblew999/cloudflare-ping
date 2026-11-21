// Every command's code, in the commands list's order (packages/shared/src/commands.ts): what the MCP
// server (src/mcp.ts) and the OpenAPI document (routes/api/openapi.json.ts) are made from.
import { coverage } from "./coverage";
import { limits } from "./limits";
import { map, remap } from "./map";
import { places } from "./places";
import { run } from "./run";
import { runs, show } from "./runs";
import { test } from "./test";
import { trace } from "./trace";

export const COMMANDS = [test, run, runs, show, limits, places, coverage, map, remap, trace];
