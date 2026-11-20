#!/usr/bin/env node
// cloudflare-ping: the app's commands, each calling the app's API as its web page does (the
// README's table). Published as the `cloudflare-ping` package (packages/cli/package.json, built by
// `vp pack` into one file: packages/cli/dist); in the repo, `vp run <task>` runs the same commands from
// source (vite.config.ts). The commands' names and help are in packages/shared/src/commands.ts, which the
// docs' command reference reads too.
import manifest from "./package.json" with { type: "json" };
import { signIn, signOut, whoami } from "./commands/account";
import { COMMAND_LIST, COMMON_OPTIONS } from "@cloudflare-ping/shared/commands";
import { coverage } from "./commands/coverage";
import { init } from "./commands/init";
import { limits } from "./commands/limits";
import { map, remap } from "./commands/map";
import { places } from "./commands/places";
import { run } from "./commands/run";
import { runs } from "./commands/runs";
import { show } from "./commands/show";
import { test } from "./commands/test";
import { trace } from "./commands/trace";

const RUNS: Record<string, (args: Array<string>) => Promise<void>> = {
  test,
  run,
  runs,
  show,
  limits,
  places,
  coverage,
  map,
  remap,
  trace,
  init,
  "sign-in": signIn,
  "sign-out": signOut,
  whoami,
};

function help() {
  console.log(`cloudflare-ping ${manifest.version}: our own Globalping, run from Cloudflare's data centres.

Usage: cloudflare-ping <command> [options]

Commands (each does what its web page does, through the same API):`);
  for (const each of COMMAND_LIST) {
    console.log(`  ${each.use}\n      ${each.about}  (on the web: ${each.page})`);
  }
  console.log(
    `\n${COMMON_OPTIONS.join("\n")}\nDocs: https://cloudflare-ping.gedw99.workers.dev/docs/`,
  );
}

// `vp run` passes its own "--" through.
const [name, ...rest] = process.argv.slice(2).filter((arg) => arg !== "--");
if (name === "--version" || name === "-v") {
  console.log(manifest.version);
} else if (!name || name === "help" || name === "--help" || name === "-h") {
  help();
} else {
  const go = RUNS[name];
  if (!go) {
    console.error(`No command "${name}".\n`);
    help();
    process.exit(1);
  }
  try {
    await go(rest);
  } catch (error) {
    // A mistyped option (each command's own, or the common --json and --site): say so plainly.
    if (
      error instanceof TypeError &&
      "code" in error &&
      String(error.code).startsWith("ERR_PARSE_ARGS")
    ) {
      console.error(`${error.message}\n\ncloudflare-ping help lists every option.`);
      process.exit(1);
    }
    throw error;
  }
}
