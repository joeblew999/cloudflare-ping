// A world map that draws points (plan 2026-11-20-03): the plain world (public/world.svg, Natural
// Earth's land) in its own projection, where x is longitude and y is minus latitude, so a point
// sits at its coordinates and nothing else. Used by the geographical coverage map (pages/
// coverage.tsx), and later by the geographical probe map: two maps, one drawing.
export type WorldPoint = {
  key: string;
  lat: number;
  lon: number;
  // Its look (pages/style.css: .world .<className>) and size.
  className: string;
  r: number;
  // Shown on hover: one string (React renders an SVG title from a single piece of text).
  title: string;
};

export function WorldMap({ points, label }: { points: Array<WorldPoint>; label: string }) {
  return (
    <svg className="world" viewBox="-180 -90 360 180" role="img" aria-label={label}>
      <use href="/world.svg#land" className="land" x="-180" y="-90" width="360" height="180" />
      {points.map((point) => (
        <circle
          key={point.key}
          className={point.className}
          cx={point.lon}
          cy={-point.lat}
          r={point.r}
        >
          <title>{point.title}</title>
        </circle>
      ))}
    </svg>
  );
}
