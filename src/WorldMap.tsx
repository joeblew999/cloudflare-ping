// A world map that draws points (plan 2026-11-20-03): the plain world (public/world.svg, Natural
// Earth's land) in its own projection, where x is longitude and y is minus latitude, so a point
// sits at its coordinates and nothing else. Used by the geographical coverage map (pages/
// coverage.tsx), and later by the geographical probe map: two maps, one drawing.
import world from "../public/world.svg?raw";
import "./WorldMap.css";

// The land, built in: the path in public/world.svg (Natural Earth's land, `vp run world`), the same
// on the site and in the coverage map's MCP App, which can load nothing.
const LAND = /\sd="([^"]+)"/.exec(world)?.[1] ?? "";

export type WorldPoint = {
  key: string;
  lat: number;
  lon: number;
  // Its look (pages/style.css: .world .<className>) and size.
  className: string;
  r: number;
  // Shown on hover: one string (React renders an SVG title from a single piece of text).
  title: string;
  // The most it may grow to, as a share of the map's width: a dot stays a dot (a hundredth, the
  // default); a circle whose area means something (a country's probes) may be bigger.
  most?: number;
};

// Where to cut the world for these points: at the widest gap between their longitudes, so a place
// across the date line (Oceania: Australia and Fiji east of it, Samoa and Tahiti west) is shown in
// one piece. The points west of the cut move a whole world east (+360°). Null: cut at the date
// line, as the plain world is.
export function cutOf(lons: ReadonlyArray<number>): number | null {
  const sorted = [...new Set(lons)].sort((a, b) => a - b);
  const [first] = sorted;
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  let widest = 360 - (last - first);
  let cut: number | null = null;
  for (const [index, lon] of sorted.entries()) {
    const before = sorted[index - 1];
    if (before !== undefined && lon - before > widest) {
      widest = lon - before;
      cut = lon;
    }
  }
  return cut;
}

// The part of the world the points are in, with room around them, kept at the world's 2:1: from
// the points' own coordinates, so a map of one country shows that country. Across the cut, the
// view may reach past 180° (to 540°), where the land is drawn a second time.
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
  const x = Math.min(Math.max((west + east) / 2 - width / 2, -180), 540 - width);
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
  // Zoomed in, the world is cut where the points leave the widest gap (`cutOf`).
  const cut = zoom ? cutOf(points.map((point) => point.lon)) : null;
  const placed =
    cut === null
      ? points
      : points.map((point) => (point.lon < cut ? { ...point, lon: point.lon + 360 } : point));
  const view =
    zoom && placed.length > 0 ? around(placed) : { x: -180, y: -90, width: 360, height: 180 };
  // Dots grow as the map zooms in, gently (by the square root of the zoom: Singapore's, 22 times
  // in, are about 5 times bigger), and never past their share of the map's width (`most`).
  const grow = Math.sqrt(view.width / 360);

  return (
    <svg
      className="world"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label={label}
    >
      {/* The land, and once more a world east when the view reaches past 180°. */}
      {(cut === null ? [0] : [0, 360]).map((shift) => (
        <path
          key={shift}
          className="land"
          d={LAND}
          fill="currentColor"
          transform={`translate(${shift} 0)`}
        />
      ))}
      {placed.map((point) => (
        <circle
          key={point.key}
          className={point.className}
          cx={point.lon}
          cy={-point.lat}
          r={Math.min(point.r * grow, view.width * (point.most ?? 0.012))}
        >
          <title>{point.title}</title>
        </circle>
      ))}
    </svg>
  );
}
