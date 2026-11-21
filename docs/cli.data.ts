// The command reference's data (docs/cli.md), read at build time from the same list
// `cloudflare-ping help` prints (packages/shared/src/commands.ts), so the docs and the CLI never differ.
import { defineLoader } from "vitepress";
import { flagLines } from "void-commands/cli";
import {
  apiOf,
  COMMAND_LIST,
  COMMON_OPTIONS,
  SIGNING_IN,
  usage,
} from "@cloudflare-ping/shared/commands";

// What the page shows of each command: plain values, which VitePress writes into the page.
export type Command = {
  name: string;
  about: string;
  usage: string;
  flags: Array<string>;
  spends: boolean;
  signedIn: boolean;
  task: string | null;
  page: string | null;
  api: string;
  mcp: boolean;
};

export type Data = { commands: Array<Command>; common: Array<string>; signingIn: string };

declare const data: Data;
export { data };

export default defineLoader({
  load: (): Data => ({
    commands: COMMAND_LIST.map((each) => ({
      name: each.name,
      about: each.about,
      usage: usage(each),
      flags: flagLines(each),
      spends: each.spends,
      signedIn: each.signedIn,
      task: each.task,
      page: each.page,
      api: apiOf(each),
      mcp: each.mcp,
    })),
    common: COMMON_OPTIONS,
    signingIn: SIGNING_IN,
  }),
});
