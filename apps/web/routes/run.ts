// Step 3 of .claude/plans/2026-11-19-01-cloudflare-ping.md: `/run?url=<address>` fetches one
// address from the data centre this request ran in, and answers where that was (`colo`, first, as
// `/where`'s), and what the target answered: its status, its `cf-ray` (whose end is the data centre
// the target ran in), its cache header and the time it took. Only addresses on the allowed list
// (packages/shared/src/targets.ts). Public, like `/where`: Globalping's probes can't sign in.
// Step 4: `&repeat=<n>` fetches it n times in a row from the same data centre, the later ones in
// `then`, to see what the first fetch left there (a page served from this data centre's edge cache
// comes back faster than one read from Void's global store, though both say `x-isr-cache: HIT`).
// Step 5: `&run=<id>` records each fetch in the database, under a run that exists (db/schema.ts);
// with `&background=1` it answers at once and fetches in the 30 seconds Cloudflare allows after
// the answer (`waitUntil`), so a run isn't held to what one Globalping test carries (step 2).
import { HTTPException } from "hono/http-exception";
import { defineHandler } from "void";
import { db, eq } from "void/db";
import { fetches, runs } from "@schema";
import { z } from "zod";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";

async function fetchOnce(target: URL) {
  const started = Date.now();
  const response = await fetch(target, {
    headers: { "user-agent": "cloudflare-ping (+https://github.com/joeblew999/cloudflare-ping)" },
    redirect: "manual",
  });
  const body = await response.text();
  const ray = response.headers.get("cf-ray") ?? "";
  return {
    status: response.status,
    ok: response.ok,
    ray,
    rayColo: ray.split("-").pop() ?? "",
    isr: response.headers.get("x-isr-cache"),
    ms: Date.now() - started,
    bytes: new TextEncoder().encode(body).length,
    body,
  };
}

export const GET = defineHandler.withValidator({
  query: z.object({
    url: z.url({ protocol: /^https$/ }),
    repeat: z.coerce.number().int().min(1).max(5).optional(),
    run: z
      .string()
      .regex(/^[A-Za-z0-9-]{8,64}$/)
      .optional(),
    background: z.literal("1").optional(),
  }),
})(async (c, { query }) => {
  const target = new URL(query.url);
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return c.json({ error: `Not on the allowed list: ${target.hostname}` }, 403);
  }
  const runId = query.run;
  if (runId) {
    const found = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, runId)).limit(1);
    if (found.length === 0) {
      throw new HTTPException(404, { message: `No such run: ${runId}` });
    }
  } else if (query.background) {
    throw new HTTPException(400, { message: "background needs a run to record into" });
  }
  const colo = c.req.raw.cf?.colo ?? null;
  const ray = c.req.header("cf-ray") ?? "";
  const times = query.repeat ?? 1;

  const fetchAll = async () => {
    const done = [];
    for (let attempt = 1; attempt <= times; attempt += 1) {
      const one = await fetchOnce(target);
      done.push(one);
      if (runId) {
        await db.insert(fetches).values({
          runId,
          ray,
          colo: typeof colo === "string" ? colo : null,
          attempt,
          target: target.toString(),
          status: one.status,
          targetRay: one.ray,
          targetColo: one.rayColo,
          isr: one.isr,
          ms: one.ms,
          bytes: one.bytes,
        });
      }
    }
    return done;
  };

  if (query.background) {
    c.executionCtx.waitUntil(fetchAll());
    return { colo, run: runId, ray, fetching: times };
  }
  const [first, ...rest] = await fetchAll();
  if (!first) {
    throw new HTTPException(500, { message: "No fetch was made" });
  }
  return {
    colo,
    target: target.toString(),
    status: first.status,
    ray: first.ray,
    rayColo: first.rayColo,
    isr: first.isr,
    ms: first.ms,
    bytes: first.bytes,
    // What went wrong, when something did: the start of the target's answer.
    ...(first.ok ? {} : { said: first.body.slice(0, 120) }),
    ...(rest.length > 0
      ? {
          then: rest.map((each) => ({
            status: each.status,
            ray: each.ray,
            rayColo: each.rayColo,
            isr: each.isr,
            ms: each.ms,
          })),
        }
      : {}),
    ...(runId ? { run: runId, recorded: 1 + rest.length } : {}),
  };
});
