// Where a zoomed-in map cuts the world: at the widest gap between its places, so a place across
// the date line is shown in one piece.
import { describe, expect, it } from "vite-plus/test";
import { cutOf } from "./WorldMap";

describe("cutOf", () => {
  it("cuts Oceania west of Australia, not at the date line", () => {
    // Perth, Sydney, Auckland, Suva; then Apia and Papeete, west of the date line.
    expect(cutOf([115.9, 151.2, 174.8, 178.4, -171.8, -149.6])).toBe(115.9);
  });

  it("leaves a place that doesn't cross the date line alone", () => {
    // Lisbon, Paris, Berlin, Kyiv.
    expect(cutOf([-9.1, 2.35, 13.4, 30.5])).toBeNull();
  });

  it("leaves one place alone", () => {
    expect(cutOf([100.5])).toBeNull();
    expect(cutOf([])).toBeNull();
  });
});
