// The MCP server's real-system check (plan 2026-11-20-01): /mcp as an agent sees it, beside the
// API and the CLI. It signs in as any MCP client does, with the official SDK's client (it finds
// where to sign in, registers itself, waits for your approval in the browser, then keeps a
// refresh token), once per machine. What it's given is kept in
// ~/.config/cloudflare-ping/mcp-check.json, readable by you only, and never printed.
//
// Then it checks the tools against the commands list (packages/shared/src/commands.ts), and asks
// each tool that only reads the same question as the API and the CLI (`--json`: the API's
// answer), comparing the three answers. It never calls the tools that spend tests (test, run,
// remap). On demand, not in `vp test`: it needs the deployed app and, the first time, you.
// `vp run mcp:check` (`-- --site <url>` for another copy of the app).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs, promisify } from "node:util";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { z } from "zod";
import { COMMAND_LIST } from "@cloudflare-ping/shared/commands";
import { SITE } from "@cloudflare-ping/shared/site";

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

// The tools that spend tests: the check never calls them, and the server must say they aren't
// read-only.
const SPENDS = ["test", "run", "remap"];

// What the check keeps between runs, per site: its registration and its tokens, with the SDK's
// own fields (StoredOAuthClientInformation, StoredOAuthTokens).
const FILE = join(homedir(), ".config", "cloudflare-ping", "mcp-check.json");
const stored = z.object({
  client: z
    .object({
      client_id: z.string(),
      client_secret: z.string().optional(),
      client_id_issued_at: z.number().optional(),
      client_secret_expires_at: z.number().optional(),
      issuer: z.string().optional(),
    })
    .optional(),
  tokens: z
    .object({
      access_token: z.string(),
      token_type: z.string(),
      id_token: z.string().optional(),
      expires_in: z.number().optional(),
      scope: z.string().optional(),
      refresh_token: z.string().optional(),
      issuer: z.string().optional(),
    })
    .optional(),
});
type Stored = z.infer<typeof stored>;

async function readStored(): Promise<Record<string, Stored>> {
  try {
    return z.record(z.string(), stored).parse(JSON.parse(await readFile(FILE, "utf8")));
  } catch {
    // None yet, or unreadable: sign in again.
    return {};
  }
}

// Where the browser comes back to, on this machine, with the approval's code.
const CALLBACK = "http://127.0.0.1:8976/callback";
const metadata: OAuthClientMetadata = {
  client_name: "cloudflare-ping mcp:check",
  redirect_uris: [CALLBACK],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "native",
  // offline_access: a refresh token, so later runs need no approval.
  scope: "openid profile email offline_access",
};

class CheckProvider implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  readonly #all: Record<string, Stored>;
  readonly #state = randomBytes(16).toString("base64url");
  #verifier = "";
  #discovery: OAuthDiscoveryState | undefined;

  constructor(all: Record<string, Stored>) {
    this.#all = all;
  }
  get redirectUrl() {
    return CALLBACK;
  }
  get clientMetadata() {
    return metadata;
  }
  state() {
    return this.#state;
  }
  clientInformation() {
    return this.#all[site]?.client;
  }
  async saveClientInformation(client: StoredOAuthClientInformation) {
    await this.#save({ ...this.#all[site], client });
  }
  tokens() {
    return this.#all[site]?.tokens;
  }
  async saveTokens(tokens: StoredOAuthTokens) {
    await this.#save({ ...this.#all[site], tokens });
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }
  saveCodeVerifier(verifier: string) {
    this.#verifier = verifier;
  }
  codeVerifier() {
    return this.#verifier;
  }
  // Which authorization server the sign-in started with, so the SDK can check the approval came
  // back from the same one (SEP-2352). Only for this run, as the code verifier is.
  saveDiscoveryState(state: OAuthDiscoveryState) {
    this.#discovery = state;
  }
  discoveryState() {
    return this.#discovery;
  }
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all" || scope === "discovery") {
      this.#discovery = undefined;
    }
    const now = this.#all[site] ?? {};
    await this.#save({
      client: scope === "all" || scope === "client" ? undefined : now.client,
      tokens: scope === "all" || scope === "tokens" ? undefined : now.tokens,
    });
  }
  async #save(next: Stored) {
    this.#all[site] = next;
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(this.#all, null, 2)}\n`, { mode: 0o600 });
  }
}

// Your approval, in the browser: the app's /login if you aren't signed in there, then /consent.
// The browser comes back to CALLBACK with the code.
function approve(url: URL, state: string): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const at = new URL(request.url ?? "/", CALLBACK);
      if (at.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const ok = at.searchParams.get("state") === state && at.searchParams.has("code");
      response.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
      response.end(
        ok ? "Approved. You can close this tab." : "Not approved. The terminal says why.",
      );
      clearTimeout(timer);
      server.close();
      if (ok) {
        resolve(at.searchParams);
      } else {
        reject(new Error(`Not approved (${at.searchParams.get("error") ?? "no code came back"})`));
      }
    });
    // Declared after the server, and only read by it once a request comes.
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("No approval within 5 minutes"));
    }, 300_000);
    server.on("error", reject);
    server.listen(Number(new URL(CALLBACK).port), "127.0.0.1", () => {
      console.log(
        `Approve this check in your browser (sign in if asked, then Allow):\n  ${url.href}`,
      );
      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "explorer"
            : "xdg-open";
      // If the browser can't be opened, the link above still works.
      execFile(opener, [url.href], () => undefined);
    });
  });
}

// Connected and signed in: with the kept tokens (refreshed by the SDK when they've run out), or
// after your approval.
async function connect(provider: CheckProvider) {
  const client = new Client({ name: "cloudflare-ping mcp:check", version: "1" });
  const transport = new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider });
  try {
    await client.connect(transport);
    return client;
  } catch (caught) {
    if (!(caught instanceof UnauthorizedError) || !provider.authorizationUrl) {
      throw caught;
    }
  }
  await transport.finishAuth(await approve(provider.authorizationUrl, provider.state()));
  const signedIn = new Client({ name: "cloudflare-ping mcp:check", version: "1" });
  await signedIn.connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider }));
  return signedIn;
}

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
    return { error: words };
  }
}

// The tool's answer: its data, or its error in the words the page and the CLI show.
async function tool(client: Client, name: string, args: Record<string, unknown>) {
  if (SPENDS.includes(name)) {
    throw new Error(`${name} spends tests: the check never calls it`);
  }
  const result = await client.callTool({ name, arguments: args });
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

// Which Cloudflare data centre gave the answer, when it says.
function coloOf(answer: unknown) {
  const parsed = z.object({ colo: z.string().nullable() }).safeParse(answer);
  return parsed.success ? parsed.data.colo : null;
}

// One question, asked of the MCP tool, the API (unless it needs signing in) and the CLI.
async function ask(
  client: Client,
  question: {
    tool: string;
    args: Record<string, unknown>;
    api: string | null;
    cli: Array<string>;
    // The answer depends on which Cloudflare data centre ran it (`limits`: each one's outgoing
    // address has its own allowance), so only answers from the same one are compared.
    perDatacentre?: boolean;
  },
) {
  const [fromMcp, fromApi, fromCli] = await Promise.all([
    tool(client, question.tool, question.args),
    question.api ? api(question.api) : null,
    cli(question.cli),
  ]);
  const mcp = JSON.stringify(fromMcp);
  const asked = `${question.tool} ${JSON.stringify(question.args)}`;
  let others: Array<[string, unknown]> = [["the CLI", fromCli]];
  if (question.api) {
    others.unshift(["the API", fromApi]);
  }
  if (question.perDatacentre) {
    const here = coloOf(fromMcp);
    const elsewhere = others.filter(([, answer]) => coloOf(answer) !== here);
    if (elsewhere.length > 0) {
      const where = elsewhere.map(([who, answer]) => `${who.slice(4)} ${coloOf(answer) ?? "?"}`);
      console.log(
        `info  ${asked}: answered in different data centres (MCP ${here ?? "?"}, ${where.join(", ")}), each with its own address's allowance, so compared only within one`,
      );
    }
    others = others.filter(([, answer]) => coloOf(answer) === here);
    if (others.length === 0) {
      return fromMcp;
    }
  }
  const differ = others.filter(([, answer]) => JSON.stringify(answer) !== mcp).map(([who]) => who);
  const surfaces = ["MCP", ...others.map(([who]) => who.replace("the ", ""))].join(", ");
  check(
    differ.length === 0,
    differ.length === 0
      ? `${asked}: ${surfaces} give identical answers (${mcp.length} characters)`
      : `${asked}: MCP differs from ${differ.join(" and ")}`,
  );
  for (const [who, answer] of others) {
    for (const line of differences(fromMcp, answer).slice(0, 5)) {
      console.log(`        ${line} from ${who.replace("the ", "")}`);
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

const client = await connect(new CheckProvider(await readStored()));
check(true, `signed in to ${mcpUrl.href} as an MCP client`);

// The tools: one per command that has one, in the command's own words, and the ones that spend
// tests marked as not read-only.
const { tools } = await client.listTools();
const commands = COMMAND_LIST.filter((each) => each.tool !== null);
const names = tools.map((each) => each.name).sort();
const expected = commands.flatMap((each) => (each.tool ? [each.tool] : [])).sort();
check(
  JSON.stringify(names) === JSON.stringify(expected),
  `the tools are the commands' own: ${names.join(", ")}`,
);
for (const command of commands) {
  const found = tools.find((each) => each.name === command.tool);
  const readOnly = found?.annotations?.readOnlyHint === true;
  check(
    (found?.description ?? "").startsWith(`${command.about}.`) &&
      readOnly === !SPENDS.includes(command.tool ?? ""),
    `${command.tool}: described as \`cloudflare-ping help\` describes it, ${readOnly ? "read-only" : "spends tests"}`,
  );
}

// Each tool that only reads, asked as the API and the CLI are.
const questions = [
  { tool: "coverage", args: {}, api: "/api/coverage", cli: ["coverage"] },
  {
    tool: "coverage",
    args: { place: "TH" },
    api: "/api/coverage?place=TH",
    cli: ["coverage", "--place", "TH"],
  },
  {
    tool: "coverage",
    args: { place: "Europe", cities: false },
    api: "/api/coverage?place=Europe&cities=false",
    cli: ["coverage", "--place", "Europe", "--no-cities"],
  },
  {
    tool: "coverage",
    args: { place: "zz" },
    api: "/api/coverage?place=zz",
    cli: ["coverage", "--place", "zz"],
  },
  { tool: "places", args: { q: "bang" }, api: "/api/places?q=bang", cli: ["places", "bang"] },
  {
    tool: "places",
    args: { q: "united", kind: "country" },
    api: "/api/places?q=united&kind=country",
    cli: ["places", "united", "--kind", "country"],
  },
  {
    tool: "places",
    args: { q: "th", limit: 5 },
    api: "/api/places?q=th&limit=5",
    cli: ["places", "th", "--limit", "5"],
  },
  { tool: "limits", args: {}, api: "/api/limits", cli: ["limits"], perDatacentre: true },
  { tool: "map", args: {}, api: "/api/map", cli: ["map"] },
];
for (const question of questions) {
  await ask(client, question);
}

// The newest run, then one of its fetches' Cloudflare log (signed in on the API: MCP and CLI).
const newest = z
  .object({ runs: z.array(z.object({ id: z.string() })) })
  .safeParse(await ask(client, { tool: "runs", args: {}, api: "/api/runs", cli: ["runs"] }));
const id = newest.success ? newest.data.runs[0]?.id : undefined;
if (id) {
  const shown = z
    .object({ fetches: z.array(z.object({ ray: z.string().nullable(), createdAt: z.string() })) })
    .safeParse(
      await ask(client, { tool: "show", args: { id }, api: `/api/runs/${id}`, cli: ["show", id] }),
    );
  const fetched = shown.success ? shown.data.fetches.find((each) => each.ray) : undefined;
  if (fetched?.ray) {
    // Back as far as that fetch, so its log is in the answer: trace looks back up to a week.
    const ago = Math.ceil((Date.now() - Date.parse(fetched.createdAt)) / 60_000) + 5;
    const minutes = Math.min(10_080, Math.max(60, ago));
    await ask(client, {
      tool: "trace",
      args: { ray: fetched.ray, minutes },
      api: null,
      cli: ["trace", fetched.ray, "--minutes", String(minutes)],
    });
  } else {
    console.log("info  the newest run has no fetch with a ray ID: trace not asked");
  }
} else {
  console.log("info  no runs: show and trace not asked");
}

await client.close();
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} failed.`);
process.exitCode = failed === 0 ? 0 : 1;
