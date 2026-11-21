// A country's place on the world map: the weighted middle of its places, across the date line too.
import { describe, expect, it } from "vite-plus/test";
import { middleOf } from "./middle";

describe("middleOf", () => {
  it("is the place itself, for one place", () => {
    expect(middleOf([{ lat: 13.75, lon: 100.5, weight: 31 }])).toEqual({ lat: 13.75, lon: 100.5 });
  });

  it("leans towards the place with more weight", () => {
    const middle = middleOf([
      { lat: 0, lon: 0, weight: 3 },
      { lat: 0, lon: 10, weight: 1 },
    ]);
    expect(middle?.lon).toBeGreaterThan(2);
    expect(middle?.lon).toBeLessThan(3);
  });

  it("stays at the date line for a country across it, not on the other side of the world", () => {
    // Fiji: Suva at 178.4°E, Lambasa near 179.4°E, Taveuni's east at 179.9°W.
    const middle = middleOf([
      { lat: -18.14, lon: 178.44, weight: 1 },
      { lat: -16.43, lon: 179.38, weight: 1 },
      { lat: -16.8, lon: -179.9, weight: 1 },
    ]);
    expect(Math.abs(middle?.lon ?? 0)).toBeGreaterThan(178);
  });

  it("is nothing, for no places", () => {
    expect(middleOf([])).toBeNull();
  });
});
