// The lists' refresh rules (plans 2026-11-20-03 and -04): a test that lands in an unknown data
// centre re-reads Cloudflare's list, then the airport places, in that order; a probe in a place
// the list doesn't have re-reads the probe list; a name list is read again only for a code it
// doesn't name. KV in memory, the sources replaced.
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { airports, countries, noticed } from "./lists";
import { AIRPORTS_URL, COUNTRIES_URL, DATACENTRES_URL, PROBES_URL } from "./reduce";

const store = new Map<string, unknown>();
vi.mock("void/kv", () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
  },
}));
vi.mock("void/log", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

let codes = ["BKK"];
const probeList = [
  {
    location: {
      continent: "AS",
      region: "South-eastern Asia",
      country: "TH",
      city: "Bangkok",
      latitude: 13.75,
      longitude: 100.5,
      asn: 23969,
      network: "TOT",
    },
  },
];
let named: Record<string, { name: string }> = { TH: { name: "Thailand" } };
const csv = () =>
  [
    '"id","iata_code","latitude_deg","longitude_deg","iso_country"',
    '1,"BKK",13.68,100.75,"TH"',
    '2,"NEW",10,20,"VN"',
  ].join("\n");
const calls: Array<string> = [];
vi.stubGlobal("fetch", async (url: string) => {
  calls.push(url);
  if (url === PROBES_URL) {
    return Response.json(probeList);
  }
  if (url === COUNTRIES_URL) {
    return Response.json(named);
  }
  if (url === DATACENTRES_URL) {
    return Response.json({
      components: codes.map((code) => ({ id: code, name: `Somewhere - (${code})` })),
    });
  }
  return new Response(csv());
});

describe("the lists", () => {
  beforeEach(async () => {
    store.clear();
    calls.length = 0;
    codes = ["BKK"];
    named = { TH: { name: "Thailand" } };
    // Everything read and kept once.
    await noticed({ places: [], colos: [] });
    await airports(codes);
    await countries(["TH"]);
    calls.length = 0;
  });

  it("a known place and data centre re-read nothing", async () => {
    await noticed({ places: [{ country: "TH", city: "Bangkok" }], colos: ["BKK"] });
    expect(calls).toEqual([]);
  });

  it("an unknown data centre re-reads Cloudflare's list, then the airport places", async () => {
    codes = ["BKK", "NEW"];
    await noticed({ places: [], colos: ["NEW"] });
    expect(calls).toEqual([DATACENTRES_URL, AIRPORTS_URL]);
    expect((await airports(codes)).NEW).toEqual({ lat: 10, lon: 20, country: "VN" });
  });

  it("a probe in a place the list doesn't have re-reads the probe list", async () => {
    await noticed({ places: [{ country: "TH", city: "Phuket" }], colos: [] });
    expect(calls).toEqual([PROBES_URL]);
  });

  it("a place with no probe any more re-reads the probe list", async () => {
    await noticed({ places: [], colos: [], unanswered: 1 });
    expect(calls).toEqual([PROBES_URL]);
  });

  it("the airport places are only read again for a code they don't have", async () => {
    await airports(["BKK"]);
    expect(calls).toEqual([]);
    await airports(["BKK", "NEW"]);
    expect(calls).toEqual([AIRPORTS_URL]);
  });

  it("the names are only read again for a code they don't name", async () => {
    expect(await countries(["TH"])).toEqual({ TH: "Thailand" });
    expect(calls).toEqual([]);
    named = { TH: { name: "Thailand" }, VN: { name: "Vietnam" } };
    expect(await countries(["TH", "VN"])).toEqual({ TH: "Thailand", VN: "Vietnam" });
    expect(calls).toEqual([COUNTRIES_URL]);
  });
});
