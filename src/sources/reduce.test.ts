// What each source's answer is turned into (src/sources/reduce.ts), from answers shaped like the
// real ones (2026-11-20).
import { describe, expect, it } from "vite-plus/test";
import {
  HAND_PLACED,
  airportPlaces,
  cloudflareDatacentres,
  continentNames,
  countryListOf,
  probeIndexOf,
  usStateNames,
} from "./reduce";

describe("cloudflareDatacentres", () => {
  const body = {
    components: [
      { id: "asia", name: "Asia", group: true },
      { id: "1", name: "Bangkok, Thailand - (BKK)", group_id: "asia" },
      { id: "2", name: "Hong Kong - (HKG)", group_id: "asia" },
      { id: "3", name: "Data Loss Prevention (DLP)", group_id: "asia" },
      { id: "4", name: "Digital Experience Monitoring (DEX)" },
    ],
  };

  it("keeps the data centres, with and without a country, and leaves out the services", () => {
    expect(cloudflareDatacentres(body)).toEqual([
      { code: "BKK", name: "Bangkok, Thailand", region: "Asia" },
      { code: "HKG", name: "Hong Kong", region: "Asia" },
    ]);
  });
});

// A probe as Globalping's list has it, somewhere in Asia unless said.
const probe = (location: {
  country: string;
  city: string;
  state?: string | null;
  latitude?: number;
  asn?: number;
  network?: string;
}) => ({
  location: {
    continent: "AS",
    region: "Eastern Asia",
    latitude: 35,
    longitude: 139,
    asn: 2516,
    network: "KDDI",
    ...location,
  },
});

describe("probeIndexOf", () => {
  const where = { continent: "AS", region: "Eastern Asia" };

  it("counts the probes in each city", () => {
    const at = (city: string) => probe({ country: "JP", city });
    expect(probeIndexOf([at("Tokyo"), at("Tokyo"), at("Osaka")]).cities).toEqual([
      { ...where, country: "JP", state: null, city: "Osaka", lat: 35, lon: 139, probes: 1 },
      { ...where, country: "JP", state: null, city: "Tokyo", lat: 35, lon: 139, probes: 2 },
    ]);
  });

  it("keeps same-named cities apart: in other countries, and in other US states", () => {
    const at = (country: string, state: string | null, latitude: number) =>
      probe({ country, state, city: "Manchester", latitude });
    expect(
      probeIndexOf([
        at("GB", null, 53.5),
        at("US", "NH", 43),
        at("US", "CT", 41.8),
        at("US", "NH", 43),
      ]).cities.map(({ country, state, probes }) => ({ country, state, probes })),
    ).toEqual([
      { country: "GB", state: null, probes: 1 },
      { country: "US", state: "CT", probes: 1 },
      { country: "US", state: "NH", probes: 2 },
    ]);
  });

  it("counts each network's probes, with every AS number they're on", () => {
    expect(
      probeIndexOf([
        probe({ country: "US", city: "Ashburn", asn: 16509, network: "Amazon.com" }),
        probe({ country: "US", city: "Ashburn", asn: 14618, network: "Amazon.com" }),
        probe({ country: "JP", city: "Tokyo" }),
      ]).networks,
    ).toEqual([
      { name: "Amazon.com", asns: [14618, 16509], probes: 2 },
      { name: "KDDI", asns: [2516], probes: 1 },
    ]);
  });
});

describe("the name lists", () => {
  it("names continents and countries from countries-list", () => {
    expect(continentNames({ AS: "Asia", EU: "Europe" })).toEqual({ AS: "Asia", EU: "Europe" });
    expect(
      countryListOf({
        TH: { name: "Thailand", native: "ประเทศไทย", continent: "AS" },
        HK: { name: "Hong Kong", continent: "AS" },
      }),
    ).toEqual({
      TH: { name: "Thailand", continent: "AS" },
      HK: { name: "Hong Kong", continent: "AS" },
    });
  });

  it("names US states from OurAirports' regions, as Globalping writes them, and only the US's", () => {
    const csv = [
      '"id","code","local_code","name","continent","iso_country","wikipedia_link","keywords"',
      '306122,"US-VA","VA","Virginia","NA","US","https://en.wikipedia.org/wiki/Virginia","Virginian airports"',
      '302811,"AD-02",02,"Canillo Parish","EU","AD","https://en.wikipedia.org/wiki/Canillo",',
    ].join("\n");
    expect(usStateNames(csv)).toEqual({ "US-VA": "Virginia" });
  });
});

describe("airportPlaces", () => {
  const csv = [
    '"id","ident","name","latitude_deg","longitude_deg","iso_country","iata_code"',
    '1,"VTBS","Suvarnabhumi, Bangkok",13.68,100.75,"TH","BKK"',
    '2,"XXXX","Not wanted",1,2,"US","ZZZ"',
  ].join("\n");

  it("places the wanted codes, quoted names and all, and the hand-placed ones", () => {
    expect(airportPlaces(csv, ["BKK", "TXL"])).toEqual({
      BKK: { lat: 13.68, lon: 100.75, country: "TH" },
      TXL: HAND_PLACED.TXL,
    });
  });
});
