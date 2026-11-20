// The words for a coverage answer (apps/web/src/commands/coverage.ts), written once: the page, its
// description, the CLI and anything else that says it in a sentence use these, so they can't say
// it differently.

type Words = {
  place: { kind: "continent" | "country"; code: string; name: string } | null;
  totals: {
    datacentres: number;
    probes: number;
    cities: number;
    countries: number;
    bothCountries: number;
    noProbeCountries: number;
    noDatacentreCountries: number;
  };
};

// Thousands with commas, the same on the server, in the browser and in a terminal.
export const count = (n: number) => n.toLocaleString("en-US");
const some = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

// "Japan (JP): 4 of Cloudflare's data centres, and 160 probes in 8 cities."
export function coverageHeadline({ place, totals }: Words): string {
  const where = place
    ? `${place.name}${place.kind === "country" ? ` (${place.code})` : ""}: ${count(totals.datacentres)} of Cloudflare's data centres`
    : `All ${count(totals.datacentres)} of Cloudflare's data centres`;
  const spread =
    place?.kind === "country"
      ? some(totals.cities, "city", "cities")
      : `${some(totals.cities, "city", "cities")} in ${some(totals.countries, "country", "countries")}`;
  return `${where}, and ${some(totals.probes, "probe", "probes")} in ${spread}.`;
}

// How data centres and probes line up, country by country.
export function coverageGaps({ totals }: Words): string {
  return `${some(totals.bothCountries, "country has", "countries have")} both data centres and probes; ${some(totals.noProbeCountries, "has", "have")} data centres but no probe, so they can only be tested from a neighbour; ${some(totals.noDatacentreCountries, "has", "have")} probes but no data centre, so their visitors are served from another country's.`;
}

// When the place asked for matches nothing: everything is shown instead.
export const coverageUnmatched = (asked: string) =>
  `No continent or country with probes matches "${asked}": here is everywhere.`;
