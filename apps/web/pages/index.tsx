// The app's home page, in the docs' look (VitePress's home: a hero, three feature cards): what it
// is, where this page was served from, and one Globalping test, the CLI's `test` (Void's page
// action, pages/index.server.ts, running src/commands/test.ts as `POST /api/probe` does): to our
// probe, or to an allowed target directly (`--host`). The answer is a deferred prop: the page
// shows at once and the answer arrives when Globalping has it.
import { Form, Link, useForm } from "@void/react";
import { Suspense, use } from "react";
import { routeUrl } from "void/routes";
import { asArgument } from "@cloudflare-ping/shared/places";
import { SITE } from "@cloudflare-ping/shared/site";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";
import { PlacePicker } from "../src/PlacePicker";
import type { Props } from "./index.server";

const HOSTS = [SITE, ...ALLOWED_HOSTS];

const FEATURES = [
  {
    title: "One test, a whole data centre",
    details:
      "Globalping counts tests. Here one test only has to reach a data centre; from there our Worker fetches as much as you ask, and the target runs in that same data centre.",
    link: "/docs/how-it-works",
    linkText: "How it works",
  },
  {
    title: "The same on the web and in a terminal",
    details:
      "Every action is one API route, one page and one command: in the repo with vp run, and anywhere with the cloudflare-ping package.",
    link: "/docs/guide",
    linkText: "What you can do",
  },
  {
    title: "Proven a step at a time",
    details:
      "Each step's question, its answer, and the raw evidence, from Globalping and from Cloudflare's own logs.",
    link: "/docs/how-it-works#what-each-step-proved",
    linkText: "Each step's answer",
  },
];

function Answer({ answer }: { answer: NonNullable<Props["answer"]> }) {
  const found = use(answer);
  if (!found.ok) {
    return (
      <div className="custom-block danger" role="alert">
        <p>{found.error}</p>
      </div>
    );
  }
  const { test } = found;
  const ours = test.site === SITE;
  return (
    <>
      <p>
        Globalping measurement{" "}
        <a href={`https://api.globalping.io/v1/measurements/${test.measurement}`}>
          {test.measurement}
        </a>
        , from {test.from}, <code>{`${test.site}${test.path}`}</code>
      </p>
      <ul className="results">
        {test.results.map((each) => (
          <li key={`${each.city}-${each.network}-${each.ray}`} className="card">
            <p className="card-title">
              {each.city}, {each.country}
            </p>
            <p className="card-details">
              {each.network} (AS{each.asn})
            </p>
            {each.error ? <p className="card-details different">{each.error}</p> : null}
            <p className="card-details">
              {ours ? (
                <span className={each.same ? "same" : "different"}>
                  {each.same ? "Same" : "Different"}: answered {each.colo || "-"}.{" "}
                </span>
              ) : null}
              cf-ray{" "}
              {each.ray ? (
                <Link href={routeUrl("/trace/[ray]", { params: { ray: each.ray } })}>
                  {each.ray}
                </Link>
              ) : (
                "-"
              )}{" "}
              · HTTP {each.httpStatus ?? "-"} · {each.totalMs ?? "-"} ms
              {each.isr ? ` · ${each.isr}` : ""}
              {each.truncated ? " · cut off" : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function HomePage({ email, here, measurement, answer }: Props) {
  const form = useForm(
    "/",
    { from: "TH", path: "/where", probes: 2, host: "" },
    { throwOnError: false },
  );
  const host = form.data.host || SITE;
  const ours = host === SITE;

  function pickHost(next: string) {
    form.setData("host", next === SITE ? "" : next);
    form.setData("path", next === SITE ? "/where" : "/en-US/events");
  }

  const command = [
    "cloudflare-ping test",
    `--from ${asArgument(form.data.from)}`,
    `--path ${form.data.path}`,
    `--probes ${form.data.probes}`,
    ...(ours ? [] : [`--host ${host}`]),
  ].join(" ");

  return (
    <main>
      <section className="hero" aria-labelledby="title">
        <div className="hero-inner">
          <h1 id="title" className="hero-heading">
            <span className="hero-name">cloudflare-ping</span>
            <span className="hero-text">
              Our own Globalping, run from Cloudflare&apos;s data centres
            </span>
          </h1>
          <p className="hero-tagline">
            A Globalping probe is only the way in. Our Worker, in the data centre it reaches, does
            the fetching, and records it.
          </p>
          <div className="hero-actions">
            <a className="button brand big" href="#probe">
              Run a probe
            </a>
            <Link className="button alt big" href="/runs">
              Runs
            </Link>
            {/* The docs are their own site (VitePress, apps/docs), so a plain link. */}
            <a className="button alt big" href="/docs/">
              Docs
            </a>
          </div>
          <p className="hero-where">
            This page was served from {here.colo ?? "?"}
            {here.city ? ` (${here.city}, ${here.country ?? "?"})` : ""}.
          </p>
        </div>
      </section>

      <section className="features" aria-label="What it is">
        <div className="features-grid">
          {FEATURES.map((each) => (
            <a key={each.title} className="card" href={each.link}>
              <h2 className="card-title">{each.title}</h2>
              <p className="card-details">{each.details}</p>
              <p className="card-link">{each.linkText} →</p>
            </a>
          ))}
        </div>
      </section>

      <div className="content vp-doc">
        <section id="probe" aria-labelledby="probe-title">
          <h2 id="probe-title">Run a probe</h2>
          <p>
            One Globalping test, from probes in a place (a country such as <code>TH</code>, a city,
            a network): to our probe (<code>/where</code> answers the data centre it reached;{" "}
            <code>/run?url=…</code> fetches a target from there), or straight to a target, as a
            visitor would. It spends Globalping tests, so it needs you signed in.
          </p>
          <Form
            form={form}
            className="form"
            renderError={(error) => (
              <div className="custom-block danger">
                <p>{error.message}</p>
              </div>
            )}
          >
            <label>
              To
              <select value={host} onChange={(event) => pickHost(event.target.value)}>
                {HOSTS.map((each) => (
                  <option key={each} value={each}>
                    {each === SITE ? `${each} (our probe)` : each}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                From
                <PlacePicker
                  name="from"
                  value={form.data.from}
                  onChange={(value) => form.setData("from", value)}
                  required
                />
                {form.errors.from ? <span className="different">{form.errors.from}</span> : null}
              </label>
              <label>
                Path
                <input
                  value={form.data.path}
                  onChange={(event) => form.setData("path", event.target.value)}
                  required
                />
                {form.errors.path ? <span className="different">{form.errors.path}</span> : null}
              </label>
              <label>
                Probes
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.data.probes}
                  onChange={(event) => form.setData("probes", Number(event.target.value))}
                  required
                />
                {form.errors.probes ? (
                  <span className="different">{form.errors.probes}</span>
                ) : null}
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button brand" disabled={form.pending || !email}>
                {form.pending ? "Asking Globalping…" : email ? "Run" : "Sign in to run"}
              </button>
            </div>
          </Form>
          <p>
            The same from a terminal: <code>{command}</code>
          </p>
          {answer ? (
            <Suspense fallback={<p>Waiting for Globalping&apos;s answer to {measurement}…</p>}>
              <Answer answer={answer} />
            </Suspense>
          ) : null}
        </section>
      </div>
    </main>
  );
}
