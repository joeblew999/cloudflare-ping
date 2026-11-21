// The package's agent skill (skills/cloudflare-ping/SKILL.md), as Void ships its own: when an
// agent should use the app, and how, in a `SKILL.md` every agent `cloudflare-ping init` sets up
// reads. Its list of commands and tools is written from packages/shared/src/commands.ts, the list
// `cloudflare-ping help`, the docs and the MCP tools come from, so the four can't differ.
// write-skill.ts writes it (the package's build); skill.test.ts fails when it's out of date.
import { COMMAND_LIST, COMMON_OPTIONS, SIGNING_IN, usage } from "@cloudflare-ping/shared/commands";
import { SITE } from "@cloudflare-ping/shared/site";

export const SKILL_PATH = "skills/cloudflare-ping/SKILL.md";

export function skillText() {
  const site = `https://${SITE}`;
  const rows = COMMAND_LIST.map((each) => {
    const marks = [each.spends ? "spends tests" : "", each.signedIn ? "needs sign-in" : ""].filter(
      (mark) => mark !== "",
    );
    const marked = marks.length > 0 ? ` (${marks.join(", ")})` : "";
    return `| \`cloudflare-ping ${usage(each)}\` | ${each.mcp ? `\`${each.name}\`` : "-"} | ${each.about}${marked} | \`${each.page}\` |`;
  });
  return `---
name: cloudflare-ping
description: Use cloudflare-ping, probes from around the world run from Cloudflare's data centres, to fetch a site from the Cloudflare data centres the probes reach, start and read runs, and see how many tests are left. Use when asked to probe, warm or check a site from Cloudflare's data centres, or about cloudflare-ping's runs.
---

# cloudflare-ping

cloudflare-ping (${site}) sends one test from probes in a place (a country such as
\`TH\`, a city, a network) to its own Worker. The Worker, in the Cloudflare data centre each probe
reached, fetches the target from there and records every fetch: a run. Tests are counted,
so starting a run or a test spends them; reading runs, limits and logs spends none.

## How to reach it

- **MCP**, when this agent has the server \`cloudflare-ping\` (\`${site}/mcp\`): the tools below.
  The first time, it signs in through the browser, as an account the app allows.
- **The CLI** otherwise: \`npx cloudflare-ping <command> --json\`. The first command that needs
  it shows a link and a code to approve in the browser; in CI, set \`CLOUDFLARE_PING_TOKEN\`.

## Working rules

- Check \`limits\` before starting runs or tests. Without the app's own token, the count
  is that of a Cloudflare address other customers share, and it can be 0 at any moment.
- A run in the background (the default) answers once the probes reach the data centres; the
  fetches come after. Read them a little later with \`show <run id>\` (over MCP, the run's answer
  links its resource, \`cloudflare-ping://runs/<id>\`), or on the run's page.
- Over MCP, the tools that spend tests need the \`tests\` scope, granted when signing in, and ask
  first when the agent can ask you. The same call twice within two minutes spends once.
- Long lists (\`runs\`, \`places\`) come a lot at a time: pass the answer's \`next\` as \`cursor\`.
- Only targets on the app's allowed list can be fetched; others are refused before any test is
  spent.
- Pass a failure on in the app's own words: they say what went wrong (a test refused, a probe that didn't reach the Worker).
- Each step of a run is in the Worker's logs under the run's ID; \`trace <ray id>\` reads one
  request's Cloudflare log.

## Commands and tools

| Command | MCP tool | What it does | On the web |
| --- | --- | --- | --- |
${rows.join("\n")}

${COMMON_OPTIONS.join("\n\n")}

Signing in: ${SIGNING_IN}

The docs: ${site}/docs/ ("From an AI agent": ${site}/docs/agents).
`;
}
