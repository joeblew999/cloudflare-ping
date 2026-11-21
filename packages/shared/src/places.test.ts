// The one search (packages/shared/src/places.ts), run by the Worker and by the picker in the
// browser alike: what comes first for what people type.
import { describe, expect, it } from "vite-plus/test";
import { groupByKind, searchPlaces, type Place } from "./places";

const place = (
  kind: Place["kind"],
  name: string,
  probes: number,
  more: Partial<Place> = {},
): Place => ({
  kind,
  name,
  within: null,
  codes: [],
  magic: name,
  probes,
  country: null,
  ...more,
});

const places: Array<Place> = [
  place("country", "Thailand", 63, { codes: ["TH"], within: "Asia", magic: "TH" }),
  place("country", "Bangladesh", 26, { codes: ["BD"], within: "Asia", magic: "BD" }),
  place("country", "Moldova", 4, { codes: ["MD"], within: "Europe", magic: "MD" }),
  place("city", "Bangkok", 32, { within: "Thailand (TH)", magic: "Bangkok+TH" }),
  place("city", "Bang Khae", 1, { within: "Thailand (TH)", magic: "Bang Khae+TH" }),
  place("city", "Dhaka", 19, { within: "Bangladesh (BD)", magic: "Dhaka+BD" }),
  place("city", "Chișinău", 3, { within: "Moldova (MD)", magic: "Chișinău+MD" }),
  place("city", "Ashburn", 51, { within: "Virginia (US-VA)", magic: "Ashburn+US-VA" }),
  place("state", "Virginia", 91, { codes: ["US-VA"], within: "United States", magic: "US-VA" }),
  place("state", "West Virginia", 1, { codes: ["US-WV"], within: "United States" }),
  place("network", "Cloudflare, Inc.", 12, { codes: ["AS13335"], within: "AS13335" }),
  place("datacentre", "BKK", 0, { codes: ["BKK"], within: "Bangkok, Thailand" }),
];
const names = (found: Array<Place>) => found.map((each) => each.name);

describe("searchPlaces", () => {
  it("an exact code first", () => {
    expect(names(searchPlaces(places, { q: "th" }))[0]).toBe("Thailand");
    expect(names(searchPlaces(places, { q: "AS13335" }))).toEqual(["Cloudflare, Inc."]);
    expect(names(searchPlaces(places, { q: "13335" }))).toEqual(["Cloudflare, Inc."]);
  });

  it("names that start with what's typed, then what they're in, most probes first", () => {
    expect(names(searchPlaces(places, { q: "bang" }))).toEqual([
      "Bangkok",
      "Bangladesh",
      "Bang Khae",
      "Dhaka",
      "BKK",
    ]);
  });

  it("the place as it's shown, as the picker's box says it after a pick", () => {
    expect(names(searchPlaces(places, { q: "Bangkok, Thailand (TH" }))).toEqual(["Bangkok"]);
    expect(names(searchPlaces(places, { q: "Thailand, Asia" }))).toEqual(["Thailand"]);
  });

  it("a word inside a name, and the places inside a state", () => {
    expect(names(searchPlaces(places, { q: "virg" }))).toEqual([
      "Virginia",
      "West Virginia",
      "Ashburn",
    ]);
  });

  it("a typo or two still finds the place, after everything that matches as typed", () => {
    expect(names(searchPlaces(places, { q: "thialand" }))).toEqual(["Thailand"]);
    expect(names(searchPlaces(places, { q: "bankok" }))).toEqual(["Bangkok"]);
    expect(names(searchPlaces(places, { q: "virginai" }))).toEqual(["Virginia", "West Virginia"]);
    expect(searchPlaces(places, { q: "xyzzy" })).toEqual([]);
  });

  it("without accents or capitals", () => {
    expect(names(searchPlaces(places, { q: "CHISINAU" }))).toEqual(["Chișinău"]);
  });

  it("only the kinds asked for, at most so many of each, and at most so many in all", () => {
    expect(names(searchPlaces(places, { q: "bang", kinds: ["city"] }))).toEqual([
      "Bangkok",
      "Bang Khae",
      "Dhaka",
    ]);
    expect(names(searchPlaces(places, { q: "bang", perKind: 1 }))).toEqual([
      "Bangkok",
      "Bangladesh",
      "BKK",
    ]);
    expect(searchPlaces(places, { q: "bang", limit: 2 })).toHaveLength(2);
  });

  it("nothing asked: every place, most probes first", () => {
    const found = searchPlaces(places);
    expect(found).toHaveLength(places.length);
    expect(found[0]?.name).toBe("Virginia");
  });

  it("nothing matching: nothing", () => {
    expect(searchPlaces(places, { q: "atlantis" })).toEqual([]);
  });
});

describe("groupByKind", () => {
  it("groups in the order the best of each comes", () => {
    expect(
      groupByKind(searchPlaces(places, { q: "bang" })).map(({ kind, places: each }) => [
        kind,
        each.length,
      ]),
    ).toEqual([
      ["city", 3],
      ["country", 1],
      ["datacentre", 1],
    ]);
  });
});
