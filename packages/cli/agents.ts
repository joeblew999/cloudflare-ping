// The coding agents `cloudflare-ping init` sets up, found as `void init` finds them: by a folder or
// file in the project, each with its skills folder. A copy of Void 1.10.0's own table
// (node_modules/void/dist/agents-*.mjs, internal, not exported); check it when Void is upgraded.
//
// `mcp` is how each agent adds the app's MCP server, from its own docs (looked up 2026-11-20; the
// source is beside each). Only files inside the project are written, never a user's global
// config: an agent that only has a global one is told what to add. Claude Code and opencode are
// tried with the real agents; the others follow their docs, and their users will tell us when
// one doesn't work (the user's call, 2026-11-20).
export type McpSetup =
  // A JSON file in the project: the server goes at `path` (merged into what's there).
  | {
      kind: "json";
      file: string;
      path: Array<string>;
      entry: (url: string) => object;
      note?: string;
    }
  // Codex's TOML (one table appended if it isn't there).
  | { kind: "codex" }
  // Continue's one-file-per-server YAML.
  | { kind: "continue" }
  // Only a global config: what to add, and where.
  | { kind: "tell"; how: (url: string) => string };

export type Agent = {
  name: string;
  skillsDir: string;
  // Any of these, at the project's root, says the agent is used here.
  markers: Array<string>;
  mcp: McpSetup;
};

const json = (
  file: string,
  path: Array<string>,
  entry: (url: string) => object,
  note?: string,
): McpSetup => ({ kind: "json", file, path, entry, ...(note ? { note } : {}) });

export const AGENTS: Array<Agent> = [
  {
    name: "Claude Code",
    skillsDir: ".claude/skills",
    markers: [".claude", "CLAUDE.md"],
    // What `claude mcp add --scope project` writes; tried with Claude Code 2.1.312.
    mcp: json(
      ".mcp.json",
      ["mcpServers"],
      (url) => ({ type: "http", url }),
      "Claude Code asks to use it once; then /mcp to sign in",
    ),
  },
  {
    name: "Amp",
    skillsDir: ".agents/skills",
    markers: [".agents"],
    // ampcode.com/manual/mcp and /docs/cli/settings: workspace settings, `amp.mcpServers`, `url`.
    mcp: json(
      ".amp/settings.json",
      ["amp.mcpServers"],
      (url) => ({ url }),
      "Amp asks to approve a workspace server",
    ),
  },
  {
    name: "Codex",
    skillsDir: ".agents/skills",
    markers: [".codex"],
    // developers.openai.com/codex/mcp: `[mcp_servers.<name>]` with `url`, in .codex/config.toml.
    mcp: { kind: "codex" },
  },
  {
    name: "Cursor",
    skillsDir: ".agents/skills",
    markers: [".cursor"],
    // cursor.com/docs/context/mcp: `mcpServers`, a remote server by `url`.
    mcp: json(
      ".cursor/mcp.json",
      ["mcpServers"],
      (url) => ({ url }),
      "approve it in Cursor's Settings, MCP",
    ),
  },
  {
    name: "Windsurf",
    skillsDir: ".windsurf/skills",
    markers: [".windsurf"],
    // docs.windsurf.com/plugins/cascade/mcp: global only, `serverUrl`.
    mcp: {
      kind: "tell",
      how: (url) =>
        `add to ~/.codeium/windsurf/mcp_config.json, under "mcpServers": "cloudflare-ping": { "serverUrl": "${url}" }`,
    },
  },
  {
    name: "Gemini CLI",
    skillsDir: ".agents/skills",
    markers: [".gemini"],
    // geminicli.com/docs/tools/mcp-server: `mcpServers`, Streamable HTTP by `httpUrl`.
    mcp: json(
      ".gemini/settings.json",
      ["mcpServers"],
      (url) => ({ httpUrl: url }),
      "then /mcp in Gemini CLI",
    ),
  },
  {
    name: "GitHub Copilot",
    skillsDir: ".agents/skills",
    markers: [".github/copilot-instructions.md"],
    // code.visualstudio.com/docs/copilot/reference/mcp-configuration: `servers`, `type: "http"`.
    mcp: json(
      ".vscode/mcp.json",
      ["servers"],
      (url) => ({ type: "http", url }),
      "VS Code signs in in the browser on first use",
    ),
  },
  {
    name: "Cline",
    skillsDir: ".cline/skills",
    markers: [".cline"],
    // docs.cline.bot/mcp/connecting-to-a-remote-server: global settings, `type: "streamableHttp"`.
    mcp: {
      kind: "tell",
      how: (url) =>
        `add in Cline's MCP Servers, Configure (cline_mcp_settings.json), under "mcpServers": "cloudflare-ping": { "type": "streamableHttp", "url": "${url}" }`,
    },
  },
  {
    name: "Roo Code",
    skillsDir: ".roo/skills",
    markers: [".roo"],
    // docs.roocode.com/features/mcp/server-transports: project .roo/mcp.json, `streamable-http`.
    mcp: json(".roo/mcp.json", ["mcpServers"], (url) => ({ type: "streamable-http", url })),
  },
  {
    name: "Kilo Code",
    skillsDir: ".kilocode/skills",
    markers: [".kilocode"],
    // kilo.ai/docs/features/mcp/using-mcp-in-kilo-code: project .kilocode/mcp.json, as Roo's.
    mcp: json(".kilocode/mcp.json", ["mcpServers"], (url) => ({ type: "streamable-http", url })),
  },
  {
    name: "Continue",
    skillsDir: ".continue/skills",
    markers: [".continue"],
    // docs.continue.dev/customize/deep-dives/mcp: .continue/mcpServers/<name>.yaml.
    mcp: { kind: "continue" },
  },
  {
    name: "Goose",
    skillsDir: ".goose/skills",
    markers: [".goose"],
    // goose-docs.ai/docs/getting-started/using-extensions: global extensions only.
    mcp: {
      kind: "tell",
      how: (url) =>
        `run goose configure, Add Extension, Remote Extension (Streamable HTTP), with ${url}`,
    },
  },
  {
    name: "OpenCode",
    skillsDir: ".agents/skills",
    markers: [".opencode"],
    // What `opencode mcp add <name> --url` writes; tried with opencode 2.2.5.
    mcp: json(
      "opencode.json",
      ["mcp", "servers"],
      (url) => ({ type: "remote", url }),
      "then opencode mcp auth cloudflare-ping",
    ),
  },
  {
    name: "Trae",
    skillsDir: ".trae/skills",
    markers: [".trae"],
    // Trae's integration guides: project .trae/mcp.json, `mcpServers`, `url`.
    mcp: json(
      ".trae/mcp.json",
      ["mcpServers"],
      (url) => ({ url }),
      "turn on Enable Project MCP in Trae",
    ),
  },
  {
    name: "Junie",
    skillsDir: ".junie/skills",
    markers: [".junie"],
    // junie.jetbrains.com/docs/junie-cli-mcp-configuration: project .junie/mcp/mcp.json.
    mcp: json(".junie/mcp/mcp.json", ["mcpServers"], (url) => ({ url })),
  },
  {
    name: "Kiro CLI",
    skillsDir: ".kiro/skills",
    markers: [".kiro"],
    // kiro.dev/docs/mcp/configuration: workspace .kiro/settings/mcp.json, remote by `url`.
    mcp: json(".kiro/settings/mcp.json", ["mcpServers"], (url) => ({ url })),
  },
  {
    name: "Zencoder",
    skillsDir: ".zencoder/skills",
    markers: [".zencoder"],
    // docs.zencoder.ai/features/mcp-deep-dive: the editor's settings, `zencoder.mcpServers`.
    mcp: {
      kind: "tell",
      how: (url) =>
        `add in Zencoder's MCP Servers settings, under "zencoder.mcpServers": "cloudflare-ping": { "url": "${url}" }`,
    },
  },
  {
    name: "Qwen Code",
    skillsDir: ".qwen/skills",
    markers: [".qwen"],
    // qwenlm.github.io/qwen-code-docs (users/features/mcp): .qwen/settings.json, `httpUrl`.
    mcp: json(".qwen/settings.json", ["mcpServers"], (url) => ({ httpUrl: url })),
  },
];
