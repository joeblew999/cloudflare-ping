// What each source's answer is turned into (src/sources/reduce.ts), from answers shaped like the
// real ones (2026-11-20).
import { describe, expect, it } from "vite-plus/test";
import { HAND_PLACED, airportPlaces, cloudflareDatacentres, probeCities } from "./reduce";

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

describe("probeCities", () => {
  it("counts the probes in each city", () => {
    const at = (city: string) => ({
      location: { country: "JP", city, latitude: 35, longitude: 139 },
    });
    expect(probeCities([at("Tokyo"), at("Tokyo"), at("Osaka")])).toEqual([
      { country: "JP", city: "Osaka", lat: 35, lon: 139, probes: 1 },
      { country: "JP", city: "Tokyo", lat: 35, lon: 139, probes: 2 },
    ]);
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
