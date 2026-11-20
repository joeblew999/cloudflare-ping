// `cloudflare-ping init`: set this project's coding agents up to use the app, as `void init` sets
// them up to use Void (its agent step, in the void package's dist/skills-*.mjs). Run in the
// project's root:
// - each agent found by its folder (agents.ts) gets this package's skill in its skills folder:
//   linked, as Void links its own, when the package is installed in the project, so it's always
//   the installed version's; copied when run from elsewhere (npx), so it doesn't point into a
//   cache;
// - AGENTS.md gets a short cloudflare-ping section (kept between markers, the rest untouched);
// - the MCP server is added where the agent's format is checked (Claude Code's .mcp.json), and
//   each other agent is told how.
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
import { AGENTS, type Agent } from "../agents";
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

const mcpJson = z.looseObject({ mcpServers: z.record(z.string(), z.unknown()).optional() });

function claudeServer(root: string, url: string) {
  const file = join(root, ".mcp.json");
  let config: z.infer<typeof mcpJson> = {};
  if (existsSync(file)) {
    const read = mcpJson.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!read.success) {
      return ".mcp.json: not a config this command understands, left as it is";
    }
    config = read.data;
  }
  const server = { type: "http", url };
  if (JSON.stringify(config.mcpServers?.[SKILL]) === JSON.stringify(server)) {
    return ".mcp.json: up to date";
  }
  config.mcpServers = { ...config.mcpServers, [SKILL]: server };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return `.mcp.json: the ${SKILL} server added (Claude Code asks to use it once)`;
}

function howToAdd(agent: Agent, url: string) {
  if (agent.mcp === "opencode") {
    return `${agent.name}: opencode mcp add ${SKILL} --url ${url}`;
  }
  return `${agent.name}: add ${url} as a remote (HTTP) MCP server in its settings`;
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
    ...found.map((agent) =>
      agent.mcp === "mcp.json" ? claudeServer(root, url) : howToAdd(agent, url),
    ),
  ];
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}
