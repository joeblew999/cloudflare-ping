// `cloudflare-ping init`: set this project's coding agents up to use the app, as `void init` sets
// them up to use Void (its agent step, in the void package's dist/skills-*.mjs). Run in the
// project's root:
// - each agent found by its folder (agents.ts) gets this package's skill in its skills folder:
//   linked, as Void links its own, when the package is installed in the project, so it's always
//   the installed version's; copied when run from elsewhere (npx), so it doesn't point into a
//   cache;
// - AGENTS.md gets a short cloudflare-ping section (kept between markers, the rest untouched);
// - the MCP server is added in each agent's own project config (agents.ts, from each one's
//   docs); an agent with only a global config is told what to add, since init only writes in
//   the project.
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { AGENTS, type Agent, type McpSetup } from "../agents";
import { siteOf } from "../api";

const SKILL = "cloudflare-ping";
const START = "<!-- cloudflare-ping:start -->";
const END = "<!-- cloudflare-ping:end -->";

// This package's own folder (where package.json names it), from the source or the built file.
function packageDir() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 5; up += 1) {
    const manifest = join(dir, "package.json");
    if (
      existsSync(manifest) &&
      readFileSync(manifest, "utf8").includes('"name": "cloudflare-ping"')
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error("The cloudflare-ping package's folder wasn't found");
}

function skillInto(root: string, skillsDir: string, source: string) {
  const folder = join(root, skillsDir);
  const target = join(folder, SKILL);
  const link = relative(folder, source);
  const installedHere = !relative(root, source).startsWith("..");
  mkdirSync(folder, { recursive: true });
  if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      return readlinkSync(target) === link
        ? `${skillsDir}/${SKILL}: already linked`
        : `${skillsDir}/${SKILL}: a link to somewhere else, left as it is`;
    }
    if (!installedHere && existsSync(join(target, "SKILL.md"))) {
      copyFileSync(join(source, "SKILL.md"), join(target, "SKILL.md"));
      return `${skillsDir}/${SKILL}: copied again (run init again after upgrading)`;
    }
    return `${skillsDir}/${SKILL}: already there, left as it is`;
  }
  if (installedHere) {
    symlinkSync(link, target, process.platform === "win32" ? "junction" : "dir");
    return `${skillsDir}/${SKILL}: linked`;
  }
  mkdirSync(target, { recursive: true });
  copyFileSync(join(source, "SKILL.md"), join(target, "SKILL.md"));
  return `${skillsDir}/${SKILL}: copied (run init again after upgrading)`;
}

function agentsSection(root: string, site: string) {
  const file = join(root, "AGENTS.md");
  const section = `${START}
## cloudflare-ping

- This project uses [cloudflare-ping](${site}): our own Globalping, run from Cloudflare's data
  centres. Starting a run or a test spends Globalping tests; check \`limits\` first.
- Its MCP server is \`${site}/mcp\` (it signs in through the browser); its CLI is
  \`cloudflare-ping\` (\`cloudflare-ping help\`). The \`${SKILL}\` skill says when to use which.
${END}`;
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  const start = before.indexOf(START);
  const end = before.indexOf(END);
  const after =
    start !== -1 && end > start
      ? `${before.slice(0, start)}${section}${before.slice(end + END.length)}`
      : `${before}${before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n"}${section}\n`;
  if (after === before) {
    return "AGENTS.md: up to date";
  }
  writeFileSync(file, after);
  return before === "" ? "AGENTS.md: written" : "AGENTS.md: cloudflare-ping section written";
}

// A JSON object. A file that isn't plain JSON (comments, say) is left as it is.
const object = z.record(z.string(), z.unknown());

type JsonSetup = Extract<McpSetup, { kind: "json" }>;

function jsonServer(root: string, setup: JsonSetup, url: string) {
  const file = join(root, setup.file);
  const entry = setup.entry(url);
  const by = `${setup.path.join(".")}.${SKILL}`;
  let config: Record<string, unknown> = {};
  if (existsSync(file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return `${setup.file}: not plain JSON, left as it is; add ${by}: ${JSON.stringify(entry)}`;
    }
    const read = object.safeParse(parsed);
    if (!read.success) {
      return `${setup.file}: not a JSON object, left as it is`;
    }
    config = read.data;
  }
  // Down the path, making each object that isn't there yet.
  let node = config;
  for (const key of setup.path) {
    const child = object.safeParse(node[key] ?? {});
    if (!child.success) {
      return `${setup.file}: "${key}" isn't an object, left as it is`;
    }
    node[key] = child.data;
    node = child.data;
  }
  if (JSON.stringify(node[SKILL]) === JSON.stringify(entry)) {
    return `${setup.file}: up to date`;
  }
  node[SKILL] = entry;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return `${setup.file}: the ${SKILL} server added${setup.note ? ` (${setup.note})` : ""}`;
}

// Codex's project config is TOML: one table, appended if it isn't there.
function codexServer(root: string, url: string) {
  const name = ".codex/config.toml";
  const file = join(root, name);
  const table = `[mcp_servers.${SKILL}]`;
  const before = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (before.includes(table)) {
    return `${name}: already has the server`;
  }
  const gap = before === "" ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${before}${gap}${table}\nurl = "${url}"\n`);
  return `${name}: the ${SKILL} server added (Codex reads it in trusted projects; sign in with codex mcp login ${SKILL})`;
}

// Continue keeps each project server in its own YAML file.
function continueServer(root: string, url: string) {
  const name = `.continue/mcpServers/${SKILL}.yaml`;
  const file = join(root, name);
  const text = `name: ${SKILL}
version: 0.0.1
schema: v1
mcpServers:
  - name: ${SKILL}
    type: streamable-http
    url: ${url}
`;
  if (existsSync(file)) {
    return readFileSync(file, "utf8") === text
      ? `${name}: up to date`
      : `${name}: already there, left as it is`;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return `${name}: written`;
}

function mcpFor(root: string, agent: Agent, url: string) {
  const setup = agent.mcp;
  const done =
    setup.kind === "json"
      ? jsonServer(root, setup, url)
      : setup.kind === "codex"
        ? codexServer(root, url)
        : setup.kind === "continue"
          ? continueServer(root, url)
          : setup.how(url);
  return `${agent.name}: ${done}`;
}

// An agent's marker that only this command made doesn't count: linking the skill makes
// `.agents/skills`, and `.agents` is also Amp's marker.
function usedHere(root: string, marker: string) {
  const path = join(root, marker);
  if (!existsSync(path)) {
    return false;
  }
  if (marker !== ".agents") {
    return true;
  }
  const skills = join(path, "skills");
  const onlyOurs =
    readdirSync(path).every((name) => name === "skills") &&
    (!existsSync(skills) || readdirSync(skills).every((name) => name === SKILL));
  return !onlyOurs;
}

export async function init(args: Array<string>) {
  const { values } = parseArgs({ args, options: { site: { type: "string" } } });
  const site = siteOf(values.site);
  const url = `${site}/mcp`;
  const root = process.cwd();
  const found = AGENTS.filter((agent) => agent.markers.some((marker) => usedHere(root, marker)));
  if (found.length === 0) {
    console.log(
      `No coding agent's folder here (.claude, .cursor, .codex, .gemini, .opencode, …). The app's MCP server is ${url}; its docs, ${site}/docs/agents.`,
    );
    return;
  }
  console.log(`Found: ${found.map((agent) => agent.name).join(", ")}`);
  const source = join(packageDir(), "skills", SKILL);
  // Several agents share a skills folder (.agents/skills): once each.
  const folders = [...new Set(found.map((agent) => agent.skillsDir))];
  const lines = [
    ...folders.map((dir) => skillInto(root, dir, source)),
    agentsSection(root, site),
    ...found.map((agent) => mcpFor(root, agent, url)),
  ];
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}
