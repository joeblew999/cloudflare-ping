// The lists' real-system check (plans 2026-11-20-03 and -04): the real sources, through the same
// reducing code the app runs (src/sources/reduce.ts), and whether the answers make sense and
// line up: every code in Globalping's list named by the name lists. Then the deployed site's
// `/api/coverage` and `/api/places` (`-- --site <url>` for another copy, as the CLI takes). Not in
// `vp test`: it depends on others' servers being up. `vp run coverage:check`.
import { parseArgs } from "node:util";
import { SITE } from "@cloudflare-ping/shared/site";
import {
  AIRPORTS_URL,
  CONTINENTS_URL,
  COUNTRIES_URL,
  DATACENTRES_URL,
  HAND_PLACED,
  PROBES_URL,
  REGIONS_URL,
  airportPlaces,
  cloudflareDatacentres,
  continentNames,
  countryListOf,
  probeIndexOf,
  usStateNames,
} from "../src/sources/reduce";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: { site: { type: "string" } },
});
let failed = 0;
const check = (ok: boolean, what: string) => {
  failed += ok ? 0 : 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
};

const probesResponse = await fetch(PROBES_URL);
const { cities, networks } = probeIndexOf(await probesResponse.json());
const probes = cities.reduce((sum, each) => sum + each.probes, 0);
check(
  probes > 1000,
  `Globalping: ${probes} probes in ${cities.length} cities, on ${networks.length} networks`,
);
const etag = probesResponse.headers.get("etag");
const again = etag ? await fetch(PROBES_URL, { headers: { "if-none-match": etag } }) : null;
check(
  again?.status === 304,
  `Globalping answers 304 to its own tag (${again?.status ?? "no tag"})`,
);

const centresResponse = await fetch(DATACENTRES_URL);
const centres = cloudflareDatacentres(await centresResponse.json());
check(centres.length > 300, `Cloudflare: ${centres.length} data centres`);
check(
  !centres.some((each) => ["DLP", "CNI", "DEX"].includes(each.code)),
  "Cloudflare's services (DLP, CNI, DEX) left out",
);
const centresTag = centresResponse.headers.get("etag");
const centresAgain = centresTag
  ? await fetch(DATACENTRES_URL, { headers: { "if-none-match": centresTag } })
  : null;
console.log(`info  Cloudflare answers ${centresAgain?.status ?? "no tag"} to its own tag`);

const placed = airportPlaces(
  await (await fetch(AIRPORTS_URL)).text(),
  centres.map((each) => each.code),
);
const unplaced = centres.filter((each) => !(each.code in placed)).map((each) => each.code);
check(
  unplaced.length === 0,
  `every data centre placed${unplaced.length > 0 ? `; not: ${unplaced.join(" ")}` : ""}`,
);
check(
  Object.keys(HAND_PLACED).every((code) => placed[code] === HAND_PLACED[code]),
  `the hand-placed ones: ${Object.keys(HAND_PLACED).join(" ")}`,
);
const bkk = placed.BKK;
check(
  Boolean(
    bkk &&
    Math.abs(bkk.lat - 13.7) < 0.5 &&
    Math.abs(bkk.lon - 100.7) < 0.5 &&
    bkk.country === "TH",
  ),
  `BKK is at Bangkok (${bkk ? `${bkk.lat}, ${bkk.lon}, ${bkk.country}` : "not placed"})`,
);

// Every code in Globalping's list has a name.
const named = (what: string, codes: Array<string>, names: Record<string, string>) => {
  const all = [...new Set(codes)];
  const unnamed = all.filter((code) => !(code in names));
  check(
    unnamed.length === 0,
    `${what}: ${all.length - unnamed.length} of ${all.length} named${unnamed.length > 0 ? `; not: ${unnamed.join(" ")}` : ""}`,
  );
};
named(
  "continents",
  cities.map((each) => each.continent),
  continentNames(await (await fetch(CONTINENTS_URL)).json()),
);
named(
  "countries",
  cities.map((each) => each.country),
  Object.fromEntries(
    Object.entries(countryListOf(await (await fetch(COUNTRIES_URL)).json())).map(([code, each]) => [
      code,
      each.name,
    ]),
  ),
);
named(
  "US states",
  cities.flatMap((each) => (each.state ? [`${each.country}-${each.state}`] : [])),
  usStateNames(await (await fetch(REGIONS_URL)).text()),
);

{
  const site = (values.site ?? `https://${SITE}`).replace(/\/+$/, "");
  const response = await fetch(`${site}/api/coverage`);
  const body: unknown = await response.json().catch(() => null);
  const totals = typeof body === "object" && body !== null && "totals" in body ? body.totals : null;
  check(response.ok && totals !== null, `${site}/api/coverage answers: ${JSON.stringify(totals)}`);
  const found = await fetch(`${site}/api/places?q=bang&limit=3`);
  const answer: unknown = await found.json().catch(() => null);
  const first =
    typeof answer === "object" &&
    answer !== null &&
    "places" in answer &&
    Array.isArray(answer.places)
      ? JSON.stringify(answer.places[0] ?? null)
      : "nothing";
  check(found.ok && first.includes("Bangkok+TH"), `${site}/api/places?q=bang: ${first}`);
}

console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
