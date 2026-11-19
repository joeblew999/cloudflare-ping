// `vp run probe:test -- --from <place> --path <path> [--probes <n>] [--site <url>]`: one
// Globalping HTTP test to the deployed probe, from probes in <place>, through the app's own API
// (`POST /api/probe`, plan step 6): the app sends the test and waits for it (src/globalping.ts),
// and this prints what came back, as it came back. Signs this machine in first if it isn't
// (scripts/sign-in.ts). `--site` points it at another copy of the app, such as `vp dev`'s.
import { parseArgs } from "node:util";
import { FetchError, fetch } from "void/client";
import { SITE } from "../src/site";
import { forget, fromEnv, token } from "./sign-in";

const { values } = parseArgs({
  // `vp run` passes its own "--" through.
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    from: { type: "string", default: "TH" },
    path: { type: "string", default: "/where" },
    probes: { type: "string", default: "1" },
    site: { type: "string", default: `https://${SITE}` },
    // Test an allowed target directly (src/targets.ts), not our probe.
    host: { type: "string" },
  },
});
const site = values.site.replace(/\/+$/, "");

const ask = async () =>
  fetch("/api/probe", {
    method: "POST",
    baseURL: site,
    headers: { authorization: `Bearer ${await token(site)}` },
    body: {
      from: values.from,
      path: values.path,
      probes: Number(values.probes),
      ...(values.host ? { host: values.host } : {}),
    },
  });

let answer;
try {
  answer = await ask();
} catch (error) {
  // A token the app no longer takes (expired, or signed out): sign in again, once.
  if (!(error instanceof FetchError && error.status === 401) || fromEnv()) {
    throw error;
  }
  await forget(site);
  answer = await ask();
}

console.log(
  `Globalping measurement ${answer.measurement}, from ${answer.from}, ${answer.site}${answer.path}\n`,
);
for (const each of answer.results) {
  console.log(`${each.city}, ${each.country} (${each.network}, AS${each.asn})`);
  if (each.error) {
    console.log(`  ${each.status}: ${each.error}`);
  }
  console.log(`  HTTP ${each.httpStatus ?? "-"}, cf-ray ${each.ray}, ${each.totalMs ?? "-"} ms`);
  console.log(`  ${each.bodyBytes} bytes back${each.truncated ? ", cut off by Globalping" : ""}`);
  if (each.isr) {
    console.log(`  x-isr-cache: ${each.isr}`);
  }
  console.log(`  answer: ${each.answer}`);
  console.log(
    `  ${each.same ? "same" : "DIFFERENT"}: answer ${each.colo || "-"}, cf-ray ${each.rayColo || "-"}\n`,
  );
}
