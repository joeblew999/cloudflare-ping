// The geographical coverage map (plan 2026-11-20-03): src/commands/coverage.ts, as
// `GET /api/coverage`. The page is cached whole for five minutes for visitors who aren't signed in
// (Void's ISR, one page per country); the API isn't (Void never caches /api); both are built from
// the lists kept in KV (src/sources/lists.ts).
import { defineHandler, defineHead, type InferProps } from "void";
import { coverage } from "../src/commands/coverage";
import { coveragePageOptions } from "../src/commands/coverage-options";

export type Props = InferProps<typeof loader>;

export const revalidate = 300;

// `/coverage?place=Europe`, `?place=TH`: one place, a link people can share (`?country=TH`, its
// old name, still works). The page draws every probe city, so it asks for them, as any caller would.
export const loader = defineHandler.withValidator({ query: coveragePageOptions })((_c, { query }) =>
  coverage({ place: query.place ?? query.country, cities: true }),
);

export const head = defineHead<Props>((_c, props) => ({
  title: "Coverage",
  meta: [
    {
      name: "description",
      content: props.place
        ? `${props.place.name}: ${props.totals.datacentres} of Cloudflare's data centres, and ${props.totals.probes} probes in ${props.totals.cities} ${props.totals.cities === 1 ? "city" : "cities"}.`
        : `All ${props.totals.datacentres} of Cloudflare's data centres, and ${props.totals.probes} probes in ${props.totals.countries} countries.`,
    },
  ],
}));
