// The command reference's data (apps/docs/cli.md), read at build time from the same list
// `cloudflare-ping help` prints (packages/shared/src/commands.ts), so the docs and the CLI never differ.
import { defineLoader } from "vitepress";
import {
  COMMAND_LIST,
  COMMON_OPTIONS,
  SIGNING_IN,
  type CommandInfo,
} from "@cloudflare-ping/shared/commands";

export type Data = { commands: Array<CommandInfo>; common: Array<string>; signingIn: string };

declare const data: Data;
export { data };

export default defineLoader({
  load: (): Data => ({ commands: COMMAND_LIST, common: COMMON_OPTIONS, signingIn: SIGNING_IN }),
});
