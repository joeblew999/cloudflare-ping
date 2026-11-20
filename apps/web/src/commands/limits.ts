// `limits`: how many Globalping tests the app has left this hour, asked by the Worker itself,
// since it's the Worker's address, or its token, that Globalping counts. Spends no test. Open.
// `GET /api/limits` and the Runs page's loader.
import { env } from "void/env";
import { globalpingLimits } from "../globalping";
import type { CommandContext } from "./context";

export const limits = async (context: CommandContext) => ({
  colo: context.colo,
  globalping: await globalpingLimits(env.GLOBALPING_TOKEN),
});
