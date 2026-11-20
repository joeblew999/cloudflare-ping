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

// The part of the world the points are in, with room around them, kept at the world's 2:1 and
// inside it: from the points' own coordinates, so a map of one country shows that country.
function around(points: Array<WorldPoint>) {
  const lons = points.map((point) => point.lon);
  const lats = points.map((point) => point.lat);
  const [west, east] = [Math.min(...lons), Math.max(...lons)];
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  const pad = Math.max(3, (east - west) * 0.15, (north - south) * 0.15);
  let width = Math.min(360, Math.max(east - west + pad * 2, 16));
  let height = Math.min(180, Math.max(north - south + pad * 2, 8));
  if (width < height * 2) {
    width = Math.min(360, height * 2);
  }
  height = width / 2;
  const x = Math.min(Math.max((west + east) / 2 - width / 2, -180), 180 - width);
  const y = Math.min(Math.max(-(south + north) / 2 - height / 2, -90), 90 - height);
  return { x, y, width, height };
}

export function WorldMap({
  points,
  label,
  zoom = false,
}: {
  points: Array<WorldPoint>;
  label: string;
  // Show only the part of the world the points are in.
  zoom?: boolean;
}) {
  const view =
    zoom && points.length > 0 ? around(points) : { x: -180, y: -90, width: 360, height: 180 };
  // Dots grow as the map zooms in, gently (by the square root of the zoom: Singapore's, 22 times
  // in, are about 5 times bigger), and never past about a hundredth of the map's width.
  const grow = Math.sqrt(view.width / 360);
  const most = view.width * 0.012;
  return (
    <svg
      className="world"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label={label}
    >
      <use href="/world.svg#land" className="land" x="-180" y="-90" width="360" height="180" />
      {points.map((point) => (
        <circle
          key={point.key}
          className={point.className}
          cx={point.lon}
          cy={-point.lat}
          r={Math.min(point.r * grow, most)}
        >
          <title>{point.title}</title>
        </circle>
      ))}
    </svg>
  );
}
