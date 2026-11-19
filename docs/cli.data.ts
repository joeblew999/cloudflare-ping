// The command reference's data (docs/cli.md), read at build time from the same list
// `cloudflare-ping help` prints (cli/commands/list.ts), so the docs and the CLI never differ.
import { defineLoader } from "vitepress";
import { COMMAND_LIST, COMMON_OPTIONS, type CommandInfo } from "../cli/commands/list";

export type Data = { commands: Array<CommandInfo>; common: Array<string> };

declare const data: Data;
export { data };

export default defineLoader({
  load: (): Data => ({ commands: COMMAND_LIST, common: COMMON_OPTIONS }),
});
