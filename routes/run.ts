// Step 3 of .claude/plans/2026-11-19-01-cloudflare-ping.md: `/run?url=<address>` fetches one
// address from the data centre this request ran in, and answers where that was (`colo`, first, as
// `/where`'s), and what the target answered: its status, its `cf-ray` (whose end is the data centre
// the target ran in), its cache header and the time it took. Only addresses on the allowed list
// (src/targets.ts). Public, like `/where`: Globalping's probes can't sign in.
import { defineHandler } from "void";
import { z } from "zod";
import { ALLOWED_HOSTS } from "../src/targets";

export const GET = defineHandler.withValidator({
  query: z.object({ url: z.url({ protocol: /^https$/ }) }),
})(async (c, { query }) => {
  const target = new URL(query.url);
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return c.json({ error: `Not on the allowed list: ${target.hostname}` }, 403);
  }
  const cf = c.req.raw.cf;
  const started = Date.now();
  const response = await fetch(target, {
    headers: { "user-agent": "cloudflare-ping (+https://github.com/joeblew999/cloudflare-ping)" },
    redirect: "manual",
  });
  const body = await response.text();
  const ms = Date.now() - started;
  const ray = response.headers.get("cf-ray") ?? "";
  return {
    colo: cf?.colo ?? null,
    target: target.toString(),
    status: response.status,
    ray,
    rayColo: ray.split("-").pop() ?? "",
    isr: response.headers.get("x-isr-cache"),
    ms,
    bytes: new TextEncoder().encode(body).length,
    // What went wrong, when something did: the start of the target's answer.
    ...(response.ok ? {} : { said: body.slice(0, 120) }),
  };
});
