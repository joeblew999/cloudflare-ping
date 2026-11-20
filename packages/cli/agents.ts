// The coding agents `cloudflare-ping init` sets up, found as `void init` finds them: by a folder or
// file in the project, each with its skills folder. A copy of Void 1.10.0's own table
// (node_modules/void/dist/agents-*.mjs, internal, not exported); check it when Void is upgraded.
// `mcp` is how the agent adds an MCP server, where that's been checked: Claude Code reads the
// project's .mcp.json (`claude mcp add --scope project` writes it); opencode 2's own command
// (checked with opencode 2.2.5, 2026-11-20, which writes `mcp.servers` in opencode.json). The
// others are told the URL.
export type Agent = {
  name: string;
  skillsDir: string;
  // Any of these, at the project's root, says the agent is used here.
  markers: Array<string>;
  mcp: "mcp.json" | "opencode" | null;
};

export const AGENTS: Array<Agent> = [
  {
    name: "Claude Code",
    skillsDir: ".claude/skills",
    markers: [".claude", "CLAUDE.md"],
    mcp: "mcp.json",
  },
  { name: "Amp", skillsDir: ".agents/skills", markers: [".agents"], mcp: null },
  { name: "Codex", skillsDir: ".agents/skills", markers: [".codex"], mcp: null },
  { name: "Cursor", skillsDir: ".agents/skills", markers: [".cursor"], mcp: null },
  { name: "Windsurf", skillsDir: ".windsurf/skills", markers: [".windsurf"], mcp: null },
  { name: "Gemini CLI", skillsDir: ".agents/skills", markers: [".gemini"], mcp: null },
  {
    name: "GitHub Copilot",
    skillsDir: ".agents/skills",
    markers: [".github/copilot-instructions.md"],
    mcp: null,
  },
  { name: "Cline", skillsDir: ".cline/skills", markers: [".cline"], mcp: null },
  { name: "Roo Code", skillsDir: ".roo/skills", markers: [".roo"], mcp: null },
  { name: "Kilo Code", skillsDir: ".kilocode/skills", markers: [".kilocode"], mcp: null },
  { name: "Continue", skillsDir: ".continue/skills", markers: [".continue"], mcp: null },
  { name: "Goose", skillsDir: ".goose/skills", markers: [".goose"], mcp: null },
  { name: "OpenCode", skillsDir: ".agents/skills", markers: [".opencode"], mcp: "opencode" },
  { name: "Trae", skillsDir: ".trae/skills", markers: [".trae"], mcp: null },
  { name: "Junie", skillsDir: ".junie/skills", markers: [".junie"], mcp: null },
  { name: "Kiro CLI", skillsDir: ".kiro/skills", markers: [".kiro"], mcp: null },
  { name: "Zencoder", skillsDir: ".zencoder/skills", markers: [".zencoder"], mcp: null },
  { name: "Qwen Code", skillsDir: ".qwen/skills", markers: [".qwen"], mcp: null },
];
