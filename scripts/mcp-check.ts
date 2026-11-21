// The MCP server's real-system check (plan 2026-11-20-01): /mcp as an agent sees it, beside the
// API and the CLI. It signs in as any MCP client does (scripts/mcp-sign-in.ts, shared with
// `vp run mcp:host`): once per machine, your approval in the browser, then a refresh token.
//
// Then it checks the tools against the commands list (packages/shared/src/commands.ts), and asks
// each tool that only reads the same question as the API and the CLI (`--json`: the API's
// answer), comparing the three answers. Each question is written once, as the command's options;
// `questionFor` makes it each surface's. Every command that only reads must be asked, and the
// commands that spend tests (their `spends`) are never called. `vp run deploy` runs it after each
// deploy; `vp run mcp:check` on its own (`-- --site <url>` for another copy of the app).
import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";
import type { Client } from "@modelcontextprotocol/client";
import { z } from "zod";
import { COMMAND_LIST, questionFor, type AnyCommand } from "@cloudflare-ping/shared/commands";
import { SITE } from "@cloudflare-ping/shared/site";
import { signedInClient } from "./mcp-sign-in";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: { site: { type: "string" } },
});
const site = values.site ?? `https://${SITE}`;
const mcpUrl = new URL("/mcp", site);
let failed = 0;
const check = (ok: boolean, what: string) => {
  failed += ok ? 0 : 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
};

const commandNamed = (name: string) => {
  const found = COMMAND_LIST.find((each) => each.name === name);
  if (!found?.mcp) {
    throw new Error(`No command ${name} with an MCP tool (packages/shared/src/commands.ts)`);
  }
  return found;
};

const run = promisify(execFile);

// The API's answer, as anyone gets it.
async function api(path: string): Promise<unknown> {
  const response = await fetch(new URL(path, site));
  return response.json();
}

// The CLI's answer (`--json`), from source, as `vp run cli` runs it. A refusal is its words.
async function cli(args: Array<string>): Promise<unknown> {
  try {
    const { stdout } = await run(
      "vpx",
      ["packages/cli/main.ts", ...args, "--json", "--site", site],
      {
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    return JSON.parse(stdout);
  } catch (caught) {
    const words =
      typeof caught === "object" && caught !== null && "stderr" in caught
        ? String(caught.stderr).trim()
        : String(caught);
    // The CLI's words without its "Failed (503): ", so a failure on purpose (trace not set up)
    // compares with MCP's, which are the words alone.
    return { error: words.replace(/^Failed \(\d+\): /, "") };
  }
}

// The tool's answer: its data, or its error in the words the page and the CLI show.
async function tool(client: Client, command: AnyCommand, options: Options) {
  if (command.spends || !command.mcp) {
    throw new Error(`${command.name} spends tests: the check never calls it`);
  }
  const result = await client.callTool({ name: command.name, arguments: options });
  if (result.isError) {
    const first = Array.isArray(result.content) ? result.content[0] : undefined;
    const text =
      typeof first === "object" && first !== null && "text" in first
        ? String(first.text)
        : "no words";
    return { error: text };
  }
  return result.structuredContent;
}

// Where two answers differ: each field's path, with both values (the first few).
function differences(mcp: unknown, other: unknown, path = ""): Array<string> {
  if (JSON.stringify(mcp) === JSON.stringify(other)) {
    return [];
  }
  if (typeof mcp === "object" && mcp !== null && typeof other === "object" && other !== null) {
    const left = new Map(Object.entries(mcp));
    const right = new Map(Object.entries(other));
    return [...new Set([...left.keys(), ...right.keys()])].flatMap((key) =>
      differences(left.get(key), right.get(key), `${path}.${key}`),
    );
  }
  const shown = (value: unknown) => JSON.stringify(value)?.slice(0, 80) ?? "nothing";
  return [`${path || "the answer"}: ${shown(mcp)} from MCP, ${shown(other)}`];
}

// What's about the request, not the app, so it differs from one request to the next whatever the
// code: which data centre ran it, which address it went out from, and that address's tests left
// right now (`limits`). Even in one data centre, a Worker's requests can go out from different
// addresses, each counted on its own without a token (found 2026-11-20: 236 left for one, 250
// for another, the same address reported). Shown side by side, never compared.
const OF_THE_REQUEST = [".colo", ".address", ".globalping.remaining", ".globalping.resetSeconds"];

function remove(value: unknown, keys: Array<string>) {
  const [first, ...rest] = keys;
  if (first === undefined || typeof value !== "object" || value === null) {
    return;
  }
  if (rest.length === 0) {
    Reflect.deleteProperty(value, first);
  } else {
    remove(Reflect.get(value, first), rest);
  }
}

// The answer without what's about the request, as compared.
function comparable(answer: unknown) {
  const copy: unknown = JSON.parse(JSON.stringify(answer ?? null));
  for (const path of OF_THE_REQUEST) {
    remove(copy, path.split(".").slice(1));
  }
  return JSON.stringify(copy);
}

type Options = Record<string, string | number | boolean>;
// The commands asked so far: each one that only reads must be.
const asked = new Set<string>();

// One question, written once as the command's options, asked of the MCP tool, the API (unless
// the command needs signing in: the API would want the CLI's token) and the CLI.
async function ask(client: Client, name: string, options: Options) {
  const command = commandNamed(name);
  const question = questionFor(command, options);
  asked.add(command.name);
  const what = `${command.name} ${JSON.stringify(options)}`;
  const answers = async () => {
    const [mcp, api_, cli_] = await Promise.all([
      tool(client, command, options),
      command.signedIn ? null : api(question.path),
      cli(question.cli),
    ]);
    const rest: Array<[string, unknown]> = command.signedIn
      ? [["CLI", cli_]]
      : [
          ["API", api_],
          ["CLI", cli_],
        ];
    return { mcp, rest };
  };
  const differing = (got: Awaited<ReturnType<typeof answers>>) =>
    got.rest.filter(([, answer]) => comparable(answer) !== comparable(got.mcp)).map(([who]) => who);
  let got = await answers();
  if (differing(got).length > 0) {
    // Asked once more: a difference in the code shows both times; a source answering differently
    // once (Cloudflare's log search, 2026-11-20: one entry instead of four) doesn't, and is shown.
    const first = got;
    got = await answers();
    if (differing(got).length === 0) {
      console.log(`info  ${what}: differed the first time, identical when asked again:`);
      for (const [who, answer] of first.rest) {
        for (const line of differences(first.mcp, answer).slice(0, 3)) {
          console.log(`info      ${line} from the ${who}`);
        }
      }
    }
  }
  const fromMcp = got.mcp;
  const others = got.rest;
  const mcp = comparable(fromMcp);
  const differ = differing(got);
  const exact = others.every(([, answer]) => JSON.stringify(answer) === JSON.stringify(fromMcp));
  check(
    differ.length === 0,
    differ.length > 0
      ? `${what}: MCP differs from the ${differ.join(" and the ")}`
      : `${what}: MCP, ${others.map(([who]) => who).join(", ")} give identical answers (${mcp.length} characters)${exact ? "" : ", apart from each request's own data centre, address and tests left"}`,
  );
  for (const [who, answer] of others) {
    for (const line of differences(fromMcp, answer).slice(0, 8)) {
      const own = OF_THE_REQUEST.some((path) => line.startsWith(`${path}:`));
      console.log(`${own ? "info  " : "      "}  ${line} from the ${who}`);
    }
  }
  return fromMcp;
}

// Signed out, /mcp refuses and says where to sign in.
const refused = await fetch(mcpUrl, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check(
  refused.status === 401 &&
    (refused.headers.get("www-authenticate") ?? "").includes("oauth-protected-resource/mcp"),
  `signed out: /mcp answers ${refused.status}, naming where to sign in`,
);

const { client } = await signedInClient(site, "cloudflare-ping mcp:check");
check(true, `signed in to ${mcpUrl.href} as an MCP client`);

// The tools: one per command that has one, in the command's own words, and the ones that spend
// tests marked as not read-only.
const { tools } = await client.listTools();
const commands = COMMAND_LIST.filter((each) => each.mcp);
const names = tools.map((each) => each.name).sort();
const expected = commands.map((each) => each.name).sort();
check(
  JSON.stringify(names) === JSON.stringify(expected),
  `the tools are the commands' own: ${names.join(", ")}`,
);
for (const command of commands) {
  const found = tools.find((each) => each.name === command.name);
  const readOnly = found?.annotations?.readOnlyHint === true;
  check(
    (found?.description ?? "").startsWith(`${command.about}.`) &&
      readOnly === !command.spends &&
      found?.outputSchema?.type === "object",
    `${command.name}: described as \`cloudflare-ping help\` describes it, ${readOnly ? "read-only" : "spends tests"}, with what it answers`,
  );
}

// The questions, each once: a command and its options.
const questions: Array<[string, Options]> = [
  ["coverage", {}],
  ["coverage", { place: "TH" }],
  ["coverage", { place: "Europe", cities: false }],
  ["coverage", { place: "zz" }],
  ["places", { q: "bang" }],
  ["places", { q: "united", kind: "country" }],
  ["places", { q: "th", limit: 5 }],
  ["limits", {}],
  ["map", {}],
];
for (const [name, options] of questions) {
  await ask(client, name, options);
}

// The newest run with fetches, then one of its fetches' Cloudflare log: their IDs come from the
// answers.
const newest = z
  .object({ runs: z.array(z.object({ id: z.string(), fetches: z.number() })) })
  .safeParse(await ask(client, "runs", {}));
// The newest run that recorded fetches, so its log can be asked for too.
const id = newest.success
  ? (newest.data.runs.find((each) => each.fetches > 0) ?? newest.data.runs[0])?.id
  : undefined;

// The next lot of runs, from a page's `next`: the same on every surface.
const page = z
  .object({ next: z.string().nullable() })
  .safeParse(await ask(client, "runs", { limit: 2 }));
if (page.success && page.data.next) {
  await ask(client, "runs", { limit: 2, cursor: page.data.next });
}
if (id) {
  const answer = await ask(client, "show", { id });
  // The same run as a resource (show's): the same answer.
  const read = await client.readResource({ uri: `cloudflare-ping://runs/${id}` });
  const [content] = read.contents;
  check(
    content !== undefined &&
      "text" in content &&
      comparable(JSON.parse(content.text)) === comparable(answer),
    `cloudflare-ping://runs/${id}: the resource is show's answer`,
  );
  const shown = z
    .object({ fetches: z.array(z.object({ ray: z.string().nullable(), createdAt: z.string() })) })
    .safeParse(answer);
  const fetched = shown.success ? shown.data.fetches.find((each) => each.ray) : undefined;
  if (fetched?.ray) {
    // Back as far as that fetch, so its log is in the answer: trace looks back up to a week.
    const ago = Math.ceil((Date.now() - Date.parse(fetched.createdAt)) / 60_000) + 5;
    await ask(client, "trace", { ray: fetched.ray, minutes: Math.min(10_080, Math.max(60, ago)) });
  }
}

// Every command that only reads was asked: a new one fails here until it has a question.
for (const command of commands.filter((each) => !each.spends)) {
  check(asked.has(command.name), `${command.name}: asked of MCP, the API and the CLI`);
}

await client.close();
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} failed.`);
process.exitCode = failed === 0 ? 0 : 1;
