// The coverage map's world (plan 2026-11-20-03): Natural Earth's land (public domain), at its
// smallest scale, as published in the `world-atlas` package (TopoJSON), drawn as one SVG
// symbol in the map's own projection (equirectangular: x is longitude, y is minus latitude, in a
// -180 -90 360 180 box), so the page places a dot at its coordinates and nothing else. Written to
// public/world.svg, a static asset: coastlines don't change. Run once: `vp run web#world`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const SOURCE = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";

const ring = z.array(z.number());
const topology = z.object({
  transform: z.object({
    scale: z.tuple([z.number(), z.number()]),
    translate: z.tuple([z.number(), z.number()]),
  }),
  arcs: z.array(z.array(z.tuple([z.number(), z.number()]))),
  objects: z.object({
    land: z.object({
      geometries: z.array(
        z.union([
          z.object({ type: z.literal("Polygon"), arcs: z.array(ring) }),
          z.object({ type: z.literal("MultiPolygon"), arcs: z.array(z.array(ring)) }),
        ]),
      ),
    }),
  }),
});

const read = topology.parse(await (await fetch(SOURCE)).json());
const [sx, sy] = read.transform.scale;
const [tx, ty] = read.transform.translate;

// TopoJSON keeps each arc as steps from the last point; an arc used backwards is ~index.
const arcs = read.arcs.map((steps) => {
  let x = 0;
  let y = 0;
  return steps.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty] as const;
  });
});
const points = (indexes: Array<number>) =>
  indexes.flatMap((index, at) => {
    const arc = index < 0 ? [...(arcs[~index] ?? [])].reverse() : (arcs[index] ?? []);
    return at === 0 ? arc : arc.slice(1);
  });
const xy = ([lon, lat]: readonly [number, number]) =>
  `${Math.round(lon * 10) / 10} ${Math.round(-lat * 10) / 10}`;

const rings = read.objects.land.geometries.flatMap((geometry) =>
  geometry.type === "Polygon" ? geometry.arcs : geometry.arcs.flat(),
);
// A shape that crosses the date line jumps from one edge of the map to the other: there the path
// starts again (M), rather than drawing a line across the whole world.
const path = rings
  .map((indexes) => {
    const ring = points(indexes);
    return ring
      .map((point, at) => {
        const before = ring[at - 1];
        const jump = !before || Math.abs(point[0] - before[0]) > 180;
        return `${jump ? "M" : "L"}${xy(point)}`;
      })
      .join("");
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="land" viewBox="-180 -90 360 180"><path fill="currentColor" d="${path}"/></symbol></svg>\n`;
const file = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "world.svg");
writeFileSync(file, svg);
console.log(
  `Wrote public/world.svg: ${rings.length} land rings, ${Math.round(svg.length / 1024)} KB`,
);
