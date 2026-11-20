// The agents table on "From an AI agent" (docs/agents.md), read at build time from the table
// `cloudflare-ping init` sets agents up from (packages/shared/src/agents.ts), so the docs say what
// init does and can't drift from it.
import { defineLoader } from "vitepress";
import { AGENTS, type McpSetup } from "@cloudflare-ping/shared/agents";
import { SITE } from "@cloudflare-ping/shared/site";

export type AgentRow = {
  name: string;
  markers: string;
  skillsDir: string;
  // Where init puts the MCP server, or what it prints when the agent has only a global config.
  file: string | null;
  how: string;
};

declare const data: Array<AgentRow>;
export { data };

const url = `https://${SITE}/mcp`;

function where(mcp: McpSetup): Pick<AgentRow, "file" | "how"> {
  switch (mcp.kind) {
    case "json":
      return {
        file: mcp.file,
        how: `${mcp.path.join(" → ")} → cloudflare-ping: ${JSON.stringify(mcp.entry(url))}${mcp.note ? `; ${mcp.note}` : ""}`,
      };
    case "codex":
      return { file: ".codex/config.toml", how: `[mcp_servers.cloudflare-ping] url = "${url}"` };
    case "continue":
      return { file: ".continue/mcpServers/cloudflare-ping.yaml", how: "type: streamable-http" };
    case "tell":
      return { file: null, how: mcp.how(url) };
  }
}

export default defineLoader({
  load: (): Array<AgentRow> =>
    AGENTS.map((agent) => ({
      name: agent.name,
      markers: agent.markers.join(", "),
      skillsDir: agent.skillsDir,
      ...where(agent.mcp),
    })),
});
