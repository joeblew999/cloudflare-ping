// What each source's answer is turned into (src/sources/reduce.ts), from answers shaped like the
// real ones (2026-11-20).
import { describe, expect, it } from "vite-plus/test";
import {
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
    '"id","name","latitude_deg","longitude_deg","iso_country","municipality","scheduled_service","iata_code","keywords"',
    '1,"Suvarnabhumi, Bangkok",13.68,100.75,"TH","Bangkok","yes","BKK",',
    '2,"Berlin-Tegel Otto Lilienthal International Airport",52.56,13.29,"DE","Berlin","no",,"TXL, EDDT"',
    '3,"Jiaxing Nanhu Airport",30.7,120.66,"CN","Xiuzhou, Hangzhou","yes","JNH",',
    '4,"Chişinău International Airport",46.93,28.93,"MD","Chişinău","yes","RMO","KIV"',
    '5,"Springfield Airport",39.84,-89.68,"US","Springfield","yes","SPI",',
    '6,"Springfield Airport",-43.33,171.92,"NZ","Springfield","yes",,',
    '7,"Not wanted",1,2,"US","Nowhere","yes","ZZZ",',
  ].join("\n");

  it("places a data centre by its code, an airport's old code, or the city in its name", () => {
    expect(
      airportPlaces(csv, [
        { code: "BKK", name: "Bangkok, Thailand" },
        { code: "TXL", name: "Berlin, Germany" },
        { code: "JXG", name: "Jiaxing, China" },
        { code: "KIV", name: "Chișinău, Moldova" },
      ]),
    ).toEqual({
      BKK: { lat: 13.68, lon: 100.75, country: "TH" },
      TXL: { lat: 52.56, lon: 13.29, country: "DE" },
      JXG: { lat: 30.7, lon: 120.66, country: "CN" },
      KIV: { lat: 46.93, lon: 28.93, country: "MD" },
    });
  });

  it("leaves a data centre unplaced when its city is in more than one country", () => {
    expect(airportPlaces(csv, [{ code: "SPX", name: "Springfield, United States" }])).toEqual({});
  });
});
