// The app's home page, in the docs' look (VitePress's home: a hero, three feature cards): what it
// is, where this page was served from, and one Globalping test from the browser, through the same
// API as the CLI's `test` (`POST /api/probe`): to our probe, or to an allowed target directly
// (`--host`).
import { useState } from "react";
import { fetch } from "void/client";
import { failure } from "@cloudflare-ping/shared/failure";
import { SITE } from "@cloudflare-ping/shared/site";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";
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

const runProbe = (body: { from: string; path: string; probes: number; host?: string }) =>
  fetch("/api/probe", { method: "POST", body });
type Answer = Awaited<ReturnType<typeof runProbe>>;

export default function HomePage({ email, here }: Props) {
  const [host, setHost] = useState(SITE);
  const [from, setFrom] = useState("TH");
  const [path, setPath] = useState("/where");
  const [probes, setProbes] = useState("2");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const ours = host === SITE;

  async function run() {
    setPending(true);
    setError("");
    try {
      setAnswer(await runProbe({ from, path, probes: Number(probes), ...(ours ? {} : { host }) }));
    } catch (caught) {
      setError(failure(caught));
    } finally {
      setPending(false);
    }
  }

  function pickHost(next: string) {
    setHost(next);
    setPath(next === SITE ? "/where" : "/en-US/events");
  }

  const command = [
    "cloudflare-ping test",
    `--from ${from}`,
    `--path ${path}`,
    `--probes ${probes}`,
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
            <a className="button alt big" href="/runs">
              Runs
            </a>
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
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
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
                <input value={from} onChange={(event) => setFrom(event.target.value)} required />
              </label>
              <label>
                Path
                <input value={path} onChange={(event) => setPath(event.target.value)} required />
              </label>
              <label>
                Probes
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={probes}
                  onChange={(event) => setProbes(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button brand" disabled={pending || !email}>
                {pending ? "Waiting for Globalping…" : email ? "Run" : "Sign in to run"}
              </button>
            </div>
          </form>
          {error ? (
            <div className="custom-block danger" role="alert">
              <p>{error}</p>
            </div>
          ) : null}
          <p>
            The same from a terminal: <code>{command}</code>
          </p>
          {answer ? (
            <>
              <p>
                Globalping measurement{" "}
                <a href={`https://api.globalping.io/v1/measurements/${answer.measurement}`}>
                  {answer.measurement}
                </a>
                , from {answer.from}, <code>{`${answer.site}${answer.path}`}</code>
              </p>
              <ul className="results">
                {answer.results.map((each) => (
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
                      cf-ray {each.ray ? <a href={`/trace/${each.ray}`}>{each.ray}</a> : "-"} · HTTP{" "}
                      {each.httpStatus ?? "-"} · {each.totalMs ?? "-"} ms
                      {each.isr ? ` · ${each.isr}` : ""}
                      {each.truncated ? " · cut off" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
