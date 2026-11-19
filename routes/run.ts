// Step 3 of .claude/plans/2026-11-19-01-cloudflare-ping.md: `/run?url=<address>` fetches one
// address from the data centre this request ran in, and answers where that was (`colo`, first, as
// `/where`'s), and what the target answered: its status, its `cf-ray` (whose end is the data centre
// the target ran in), its cache header and the time it took. Only addresses on the allowed list
// (src/targets.ts). Public, like `/where`: Globalping's probes can't sign in.
// Step 4: `&repeat=<n>` fetches it n times in a row from the same data centre, the later ones in
// `then`, to see what the first fetch left there (a page served from this data centre's edge cache
// comes back faster than one read from Void's global store, though both say `x-isr-cache: HIT`).
import { defineHandler } from "void";
import { z } from "zod";
import { ALLOWED_HOSTS } from "../src/targets";

async function fetchOnce(target: URL) {
  const started = Date.now();
  const response = await fetch(target, {
    headers: { "user-agent": "cloudflare-ping (+https://github.com/joeblew999/cloudflare-ping)" },
    redirect: "manual",
  });
  const body = await response.text();
  const ms = Date.now() - started;
  const ray = response.headers.get("cf-ray") ?? "";
  return { response, body, ms, ray, rayColo: ray.split("-").pop() ?? "" };
}

export const GET = defineHandler.withValidator({
  query: z.object({
    url: z.url({ protocol: /^https$/ }),
    repeat: z.coerce.number().int().min(1).max(5).optional(),
  }),
})(async (c, { query }) => {
  const target = new URL(query.url);
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return c.json({ error: `Not on the allowed list: ${target.hostname}` }, 403);
  }
  const cf = c.req.raw.cf;
  const first = await fetchOnce(target);
  const then = [];
  for (let more = 1; more < (query.repeat ?? 1); more += 1) {
    const again = await fetchOnce(target);
    then.push({
      status: again.response.status,
      ray: again.ray,
      rayColo: again.rayColo,
      isr: again.response.headers.get("x-isr-cache"),
      ms: again.ms,
    });
  }
  return {
    colo: cf?.colo ?? null,
    target: target.toString(),
    status: first.response.status,
    ray: first.ray,
    rayColo: first.rayColo,
    isr: first.response.headers.get("x-isr-cache"),
    ms: first.ms,
    bytes: new TextEncoder().encode(first.body).length,
    // What went wrong, when something did: the start of the target's answer.
    ...(first.response.ok ? {} : { said: first.body.slice(0, 120) }),
    ...(then.length > 0 ? { then } : {}),
  };
});
