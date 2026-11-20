// Step 1 of .claude/plans/2026-11-19-01-cloudflare-ping.md: the Cloudflare data centre this
// request ran in, as Cloudflare tells the Worker (`request.cf.colo`), and where the request came
// from. The proof is that the same code ends the response's `cf-ray` header.
// Step 2: `?wait=<ms>` answers after that long, and `?size=<bytes>` pads the answer to that many
// bytes, to find how long Globalping waits for an answer and how much of it it gives back. `colo`
// stays first, so even a cut-off answer says where it ran.
import { defineHandler } from "void";
import { z } from "zod";

export const GET = defineHandler.withValidator({
  query: z.object({
    // Globalping gives up after 15 seconds (step 2), so longer is never needed.
    wait: z.coerce.number().int().min(0).max(30_000).optional(),
    size: z.coerce.number().int().min(0).max(1_000_000).optional(),
  }),
})(async (c, { query }) => {
  const cf = c.req.raw.cf;
  if (query.wait) {
    await new Promise((done) => setTimeout(done, query.wait));
  }
  const answer = {
    colo: cf?.colo ?? null,
    country: cf?.country ?? null,
    city: cf?.city ?? null,
    asn: cf?.asn ?? null,
    ...(query.wait === undefined ? {} : { waited: query.wait }),
  };
  if (!query.size) {
    return answer;
  }
  const bare = JSON.stringify({ ...answer, pad: "" }).length;
  return { ...answer, pad: "x".repeat(Math.max(0, query.size - bare)) };
});
