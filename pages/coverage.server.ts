// The geographical coverage map (plan 2026-11-20-03): src/commands/coverage.ts, as
// `GET /api/coverage`. The page is cached whole for five minutes for visitors who aren't signed in
// (Void's ISR, one page per country); the API isn't (Void never caches /api); both are built from
// the lists kept in KV (src/sources/lists.ts). The place box's places come deferred
// (src/commands/places.ts).
import { defineHandler, defineHead, defer, type InferProps } from "void";
import { coverageHeadline } from "@cloudflare-ping/shared/coverage";
import { PLACE_FIELDS } from "@cloudflare-ping/shared/places";
import { runCommand } from "../src/commands/context";
import { coverage } from "../src/commands/coverage";
import { placesFor } from "../src/commands/places";

export type Props = InferProps<typeof loader>;

export const revalidate = 300;

// `/coverage?place=Europe`, `?place=TH`: one place, a link people can share. The same options and
// defaults as the API, the CLI and the MCP tool.
export const loader = defineHandler.withValidator({ query: coverage.definition.input })(
  async (c, { query }) => ({
    ...(await runCommand(c, coverage, query, { surface: "page" })),
    places: defer(() => placesFor(PLACE_FIELDS.coverage)),
  }),
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
