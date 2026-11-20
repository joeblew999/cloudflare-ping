// The geographical coverage map (plan 2026-11-20-03): src/commands/coverage.ts, as
// `GET /api/coverage`. Cached whole for five minutes for visitors who aren't signed in (Void's
// ISR); its lists are kept in KV (src/sources/lists.ts).
import { defineHandler, defineHead, type InferProps } from "void";
import { coverage } from "../src/commands/coverage";

export type Props = InferProps<typeof loader>;

export const revalidate = 300;

export const loader = defineHandler(() => coverage());

export const head = defineHead<Props>((_c, props) => ({
  title: "Coverage",
  meta: [
    {
      name: "description",
      content: `All ${props.totals.datacentres} of Cloudflare's data centres, and Globalping's ${props.totals.probes} probes in ${props.totals.countries} countries.`,
    },
  ],
}));
