// Every place from the lists (src/sources/places.ts): which exist and their probes from
// Globalping's list, their names from the name lists, and what's sent to Globalping as
// globalping.io fills it in (2026-11-20).
import { describe, expect, it } from "vite-plus/test";
import { placesOf } from "./places";
import type { ProbeIndex } from "./reduce";

const probes: ProbeIndex = {
  cities: [
    {
      continent: "AS",
      region: "South-eastern Asia",
      country: "TH",
      state: null,
      city: "Bangkok",
      lat: 13.75,
      lon: 100.5,
      probes: 32,
    },
    {
      continent: "NA",
      region: "Northern America",
      country: "US",
      state: "VA",
      city: "Ashburn",
      lat: 39,
      lon: -77.5,
      probes: 51,
    },
    {
      continent: "NA",
      region: "Northern America",
      country: "US",
      state: "VA",
      city: "Reston",
      lat: 38.9,
      lon: -77.3,
      probes: 10,
    },
  ],
  networks: [{ name: "Amazon.com", asns: [14618, 16509], probes: 58 }],
};

const all = placesOf({
  probes,
  continents: { AS: "Asia", NA: "North America" },
  countries: {
    TH: { name: "Thailand", continent: "AS" },
    US: { name: "United States", continent: "NA" },
  },
  states: { "US-VA": "Virginia" },
  datacentres: [{ code: "BKK", name: "Bangkok, Thailand", region: "Asia", country: "TH" }],
});
const find = (kind: string, name: string) =>
  all.find((each) => each.kind === kind && each.name === name);

describe("placesOf", () => {
  it("counts each place's probes from its cities", () => {
    expect(find("continent", "North America")?.probes).toBe(61);
    expect(find("region", "Northern America")?.probes).toBe(61);
    expect(find("country", "United States")?.probes).toBe(61);
    expect(find("state", "Virginia")?.probes).toBe(61);
    expect(find("city", "Ashburn")?.probes).toBe(51);
  });

  it("names Globalping's codes from the name lists, and sends Globalping its own location text", () => {
    expect(find("continent", "Asia")).toMatchObject({ codes: ["AS"], magic: "Asia" });
    expect(find("country", "Thailand")).toMatchObject({
      within: "Asia",
      codes: ["TH"],
      magic: "TH",
    });
    expect(find("state", "Virginia")).toMatchObject({ codes: ["US-VA"], magic: "US-VA" });
    expect(find("city", "Bangkok")).toMatchObject({
      within: "Thailand (TH)",
      magic: "Bangkok+TH",
    });
    expect(find("city", "Ashburn")).toMatchObject({
      within: "Virginia (US-VA)",
      magic: "Ashburn+US-VA",
    });
  });

  it("finds a network by its AS numbers, and a data centre by its code", () => {
    expect(find("network", "Amazon.com")).toMatchObject({
      within: "AS14618, AS16509",
      codes: ["AS14618", "AS16509"],
      magic: "Amazon.com",
      probes: 58,
    });
    expect(find("datacentre", "BKK")).toMatchObject({
      within: "Bangkok, Thailand",
      magic: "BKK",
      probes: 0,
      country: "TH",
    });
  });

  it("shows a code it has no name for as the code, rather than leaving the place out", () => {
    const unnamed = placesOf({
      probes,
      continents: {},
      countries: {},
      states: {},
      datacentres: [],
    });
    expect(unnamed.find((each) => each.kind === "country" && each.magic === "TH")?.name).toBe("TH");
  });

  it("puts a country's probes in the continent the countries list gives it, as coverage does", () => {
    const moved = placesOf({
      probes: {
        cities: [
          {
            continent: "EU",
            region: "Eastern Europe",
            country: "RU",
            state: null,
            city: "Moscow",
            lat: 55.75,
            lon: 37.6,
            probes: 1,
          },
        ],
        networks: [],
      },
      continents: { AS: "Asia", EU: "Europe" },
      countries: { RU: { name: "Russia", continent: "AS" } },
      states: {},
      datacentres: [],
    });
    expect(moved.filter((each) => each.kind === "continent").map((each) => each.name)).toEqual([
      "Asia",
    ]);
  });
});
