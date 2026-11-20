// `test`: one Globalping test, to our probe or straight to an allowed target (plan steps 1, 4
// and 6). Signed in only: it spends a Globalping test. `POST /api/probe` makes it and waits;
// the home page's action makes it and redirects, and its loader waits (`result`).
import { env } from "void/env";
import { z } from "zod";
import { makeTest, probeFrom, testResult } from "../globalping";

export const input = z.object({
  from: z.string().min(1),
  // A pattern, not `startsWith`, whose JSON Schema form ("format": "starts_with") isn't standard.
  path: z.string().regex(/^\//, "A path starts with /"),
  probes: z.number().int().min(1).max(10),
  // Our probe unless given; otherwise a target `/run` may fetch (src/globalping.ts).
  host: z.string().optional(),
});
export type TestInput = z.infer<typeof input>;

const optionsOf = (body: TestInput) => ({
  ...body,
  host: body.host || undefined,
  token: env.GLOBALPING_TOKEN,
});

// Make the test and wait for its answer.
export const test = (body: TestInput) => probeFrom(optionsOf(body));

// Make the test; its measurement's ID.
export const start = (body: TestInput) => makeTest(optionsOf(body));

// A test's answer, by its measurement's ID.
export const result = (measurement: string) => testResult(measurement, env.GLOBALPING_TOKEN);

export const measurementId = z.string().regex(/^[A-Za-z0-9]{8,64}$/);
