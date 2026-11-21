// Where to put a country on the world map (plan 2026-11-21-03): the middle of its places on the
// globe, each weighted (a probe city by its probes). The mean of their directions from the
// earth's centre, not of their numbers, so a country across the date line (Fiji: 178°E and
// 179°W) stays there rather than landing on the other side of the world. Null for no places.
export function middleOf(
  places: ReadonlyArray<{ lat: number; lon: number; weight: number }>,
): { lat: number; lon: number } | null {
  let x = 0;
  let y = 0;
  let z = 0;
  let total = 0;
  for (const { lat, lon, weight } of places) {
    const across = (lat * Math.PI) / 180;
    const around = (lon * Math.PI) / 180;
    x += weight * Math.cos(across) * Math.cos(around);
    y += weight * Math.cos(across) * Math.sin(around);
    z += weight * Math.sin(across);
    total += weight;
  }
  if (total === 0) {
    return null;
  }
  // To a hundredth of a degree (about a kilometre): a dot on a map needs no more.
  const rounded = (radians: number) => Math.round((radians * 180 * 100) / Math.PI) / 100;
  return { lat: rounded(Math.atan2(z, Math.hypot(x, y))), lon: rounded(Math.atan2(y, x)) };
}
