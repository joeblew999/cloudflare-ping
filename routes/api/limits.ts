// `GET /api/limits`: how many Globalping tests the app has left this hour, as the Worker sees it
// (src/commands/limits.ts). Spends no test. Open. The CLI's `limits`.
import { defineHandler } from "void";
import { runCommand } from "../../src/commands/context";
import { limits } from "../../src/commands/limits";

export const GET = defineHandler((c) => runCommand(c, limits, {}));
