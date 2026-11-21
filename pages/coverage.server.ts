// The geographical coverage map (plan 2026-11-20-03): src/commands/coverage.ts, as
// `GET /api/coverage`. The page is cached whole for five minutes for visitors who aren't signed in
// (Void's ISR, one page per country); the API isn't (Void never caches /api); both are built from
// the lists kept in KV (src/sources/lists.ts).
import { defineHandler, defineHead, type InferProps } from "void";
import { coverageHeadline } from "@cloudflare-ping/shared/coverage";
import { runCommand } from "../src/commands/context";
import { coverage } from "../src/commands/coverage";

export type Props = InferProps<typeof loader>;

export const revalidate = 300;

// `/coverage?place=Europe`, `?place=TH`: one place, a link people can share. The same options and
// defaults as the API, the CLI and the MCP tool.
export const loader = defineHandler.withValidator({ query: coverage.definition.input })(
  (c, { query }) => runCommand(c, coverage, query, { surface: "page" }),
);

export const head = defineHead<Props>((_c, props) => ({
  title: "Coverage",
  meta: [
    {
      name: "description",
      content: coverageHeadline(props),
    },
  ],
}));
