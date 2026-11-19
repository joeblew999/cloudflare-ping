// Step 1 of .claude/plans/2026-11-19-01-cloudflare-ping.md: the Cloudflare data centre this
// request ran in, as Cloudflare tells the Worker (`request.cf.colo`), and where the request came
// from. The proof is that the same code ends the response's `cf-ray` header.
import { defineHandler } from "void";

export const GET = defineHandler((c) => {
  const cf = c.req.raw.cf;
  return {
    colo: cf?.colo ?? null,
    country: cf?.country ?? null,
    city: cf?.city ?? null,
    asn: cf?.asn ?? null,
  };
});
