#!/usr/bin/env node
// cloudflare-ping: the app's commands, each calling the app's API as its web page does (the
// README's table). Published as the `cloudflare-ping` package (cli/package.json, built by
// `vp pack` into one file: cli/dist); in the repo, `vp run <task>` runs the same commands from
// source (vite.config.ts).
import manifest from "./package.json" with { type: "json" };
import { signIn, signOut, whoami } from "./commands/account";
import { run } from "./commands/run";
import { runs } from "./commands/runs";
import { show } from "./commands/show";
import { test } from "./commands/test";
import { trace } from "./commands/trace";

type Command = {
  use: string;
  about: string;
  page: string;
  go: (args: Array<string>) => Promise<void>;
};

const COMMANDS: Record<string, Command> = {
  test: {
    use: "test [--from TH] [--path /where] [--probes 1] [--host <target>]",
    about: "One Globalping test, to our probe or straight to a target",
    page: "/",
    go: test,
  },
  run: {
    use: "run [--target <url>] [--from TH] [--probes 2] [--repeat 1] [--inline]",
    about: "Start a run and follow its fetches as they're recorded",
    page: "/runs",
    go: run,
  },
  runs: { use: "runs", about: "The newest runs", page: "/runs", go: runs },
  show: { use: "show <run id>", about: "One run and its fetches", page: "/runs/<id>", go: show },
  trace: {
    use: "trace <ray id> [--minutes 60]",
    about: "A request's Cloudflare log, by its cf-ray",
    page: "/trace/<ray>",
    go: trace,
  },
  "sign-in": { use: "sign-in", about: "Sign this machine in", page: "/login", go: signIn },
  "sign-out": { use: "sign-out", about: "Sign this machine out", page: "Sign out", go: signOut },
  whoami: {
    use: "whoami",
    about: "Who this machine is signed in as",
    page: "the top bar",
    go: whoami,
  },
};

function help() {
  console.log(`cloudflare-ping ${manifest.version}: our own Globalping, run from Cloudflare's data centres.

Usage: cloudflare-ping <command> [options]

Commands (each does what its web page does, through the same API):`);
  for (const each of Object.values(COMMANDS)) {
    console.log(`  ${each.use}\n      ${each.about}  (on the web: ${each.page})`);
  }
  console.log(`
Every command takes --site <url> (another copy of the app; the deployed one unless given),
and those that print results take --json. Signing in: the first command that needs it shows a
link and a code to approve in the browser. In CI, set CLOUDFLARE_PING_TOKEN.`);
}

// `vp run` passes its own "--" through.
const [name, ...rest] = process.argv.slice(2).filter((arg) => arg !== "--");
if (name === "--version" || name === "-v") {
  console.log(manifest.version);
} else if (!name || name === "help" || name === "--help" || name === "-h") {
  help();
} else {
  const command = COMMANDS[name];
  if (!command) {
    console.error(`No command "${name}".\n`);
    help();
    process.exit(1);
  }
  await command.go(rest);
}
