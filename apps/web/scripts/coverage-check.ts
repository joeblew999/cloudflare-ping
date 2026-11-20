// The coverage map's real-system check (plan 2026-11-20-03): the three real sources, through the
// same reducing code the app runs (src/sources/reduce.ts), and whether the answers make sense.
// With a site (`-- --site <url>`), that site's `/api/coverage` too. On demand, not in `vp test`:
// it depends on others' servers being up. `vp run coverage:check`.
import { parseArgs } from "node:util";
import {
  AIRPORTS_URL,
  DATACENTRES_URL,
  HAND_PLACED,
  PROBES_URL,
  airportPlaces,
  cloudflareDatacentres,
  probeCities,
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
const cities = probeCities(await probesResponse.json());
const probes = cities.reduce((sum, each) => sum + each.probes, 0);
check(probes > 1000, `Globalping: ${probes} probes in ${cities.length} cities`);
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

if (values.site) {
  const site = values.site.replace(/\/+$/, "");
  const response = await fetch(`${site}/api/coverage`);
  const body: unknown = await response.json().catch(() => null);
  const totals = typeof body === "object" && body !== null && "totals" in body ? body.totals : null;
  check(response.ok && totals !== null, `${site}/api/coverage answers: ${JSON.stringify(totals)}`);
}

console.log(failed === 0 ? "\nAll checks pass." : `\n${failed} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
