// `cloudflare-ping places [<what>] [--kind <kind>] [--limit <n>]`: places to test from, or to
// narrow a list to (`GET /api/places`), in groups by kind, each with its probes and what to pass
// as `--from`. Nothing asked: how many of each kind, and the most-probed few. What the forms'
// place picker offers.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import {
  KIND_LABELS,
  PLACE_KINDS,
  groupByKind,
  type PlaceKind,
} from "@cloudflare-ping/shared/places";
import { asked, commonOptions, headers, printedJson, siteOf, stop } from "../api";

const isKind = (kind: string): kind is PlaceKind => PLACE_KINDS.some((each) => each === kind);

export async function places(args: Array<string>) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { kind: { type: "string" }, limit: { type: "string" }, ...commonOptions },
  });
  const site = siteOf(values.site);
  const kind = values.kind;
  if (kind !== undefined && !isKind(kind)) {
    return stop(new Error(`--kind is one of: ${PLACE_KINDS.join(", ")}`));
  }
  const q = positionals.join(" ");
  const found = await asked(() =>
    fetch("/api/places", {
      query: {
        ...(q ? { q } : {}),
        ...(kind ? { kind } : {}),
        ...(values.limit ? { limit: values.limit } : {}),
      },
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  if (found.places.length === 0) {
    console.log(`No place matches "${q}".`);
    return;
  }
  // As the picker shows them: up to 8 of each kind.
  const shown = 8;
  for (const group of groupByKind(found.places)) {
    console.log(`${KIND_LABELS[group.kind]} (${group.places.length})`);
    for (const place of group.places.slice(0, shown)) {
      const what = `${place.name}${place.within ? `, ${place.within}` : ""}`;
      const probes =
        place.kind === "datacentre"
          ? ""
          : `${place.probes.toLocaleString("en-US")} ${place.probes === 1 ? "probe" : "probes"}`;
      const pass = place.kind === "datacentre" ? `--at ${place.magic}` : `--from "${place.magic}"`;
      console.log(`  ${what.padEnd(48)} ${probes.padStart(13)}  ${pass}`);
    }
    if (group.places.length > shown) {
      console.log(`  and ${group.places.length - shown} more`);
    }
  }
}
