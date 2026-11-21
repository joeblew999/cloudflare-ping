// `run`: start a run (src/runs.ts). Signed in only: it spends a Globalping test. `POST /api/runs`
// and the Runs page's action. It answers once the probes reach us; what follows is `show`.
import { run as definition } from "@cloudflare-ping/shared/commands";
import { env } from "void/env";
import { z } from "zod";
import { fail } from "void-commands/server";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";
import { startRunEverywhere } from "../everywhere";
import { startRun } from "../runs";
import { implement } from "./context";
import { testAnswer } from "./test";

export type RunInput = z.output<typeof definition.input>;

export const runAnswer = z.object({
  id: z.string(),
  // How many fetches to expect: what `show` should reach.
  expected: z.number(),
  // The Globalping test that carried it; none for a run everywhere, sent on the queue.
  test: testAnswer.nullable(),
  // A run everywhere: how many data centres it expects.
  dataCentres: z.number().optional(),
});

export const run = implement(definition, runAnswer, async (body, context) => {
  const host = new URL(body.target).hostname;
  // Refused before any test is spent, whoever asks: with an AI calling the tool, this is what
  // stops it being talked into fetching anywhere.
  if (!ALLOWED_HOSTS.has(host)) {
    fail("not_allowed", `Not on the allowed list: ${host}`);
  }
  if (body.everywhere) {
    return startRunEverywhere({
      target: body.target,
      repeat: body.repeat,
      everywhere: body.everywhere,
    });
  }
  // Seen through even if the page or CLI that asked goes away while the test is out: a client
  // that disconnects can cancel its request's work, unless `waitUntil` holds it (Cloudflare's
  // docs: Workers, "Request cancellation").
  const started = startRun({ ...body, token: env.GLOBALPING_TOKEN });
  context.waitUntil(started.catch(() => undefined));
  return started;
});
