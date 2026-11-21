// `test`: one Globalping test, to our probe or straight to an allowed target (plan steps 1, 4
// and 6). Signed in only: it spends a Globalping test. `POST /api/probe` makes it and waits;
// the home page's action makes it and redirects, and its loader waits (`result`).
import { test as definition } from "@cloudflare-ping/shared/commands";
import { env } from "void/env";
import { z } from "zod";
import { makeTest, probeFrom, testResult } from "../globalping";
import { implement } from "./context";

export type TestInput = z.output<typeof definition.input>;

// A test's answer (src/globalping.ts, `testResult`): what was asked, and each probe's fetch.
export const testAnswer = z.object({
  measurement: z.string(),
  site: z.string(),
  from: z.string(),
  path: z.string(),
  status: z.string(),
  results: z.array(
    z.object({
      city: z.string(),
      country: z.string(),
      network: z.string(),
      asn: z.number(),
      status: z.string(),
      error: z.string(),
      httpStatus: z.number().nullable(),
      totalMs: z.number().nullable(),
      bodyBytes: z.number(),
      truncated: z.boolean(),
      ray: z.string(),
      rayColo: z.string(),
      isr: z.string(),
      answer: z.string(),
      colo: z.string(),
      same: z.boolean(),
    }),
  ),
});

const optionsOf = (body: TestInput) => ({
  ...body,
  host: body.host || undefined,
  token: env.GLOBALPING_TOKEN,
});

// Make the test and wait for its answer.
export const test = implement(definition, testAnswer, (body) => probeFrom(optionsOf(body)));

// Make the test; its measurement's ID (the home page's action, which doesn't wait).
export const start = (body: TestInput) => makeTest(optionsOf(body));

// A test's answer, by its measurement's ID.
export const result = (measurement: string) => testResult(measurement, env.GLOBALPING_TOKEN);

export const measurementId = z.string().regex(/^[A-Za-z0-9]{8,64}$/);
