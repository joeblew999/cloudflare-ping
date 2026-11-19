// The app's home page: where this page was served from, and one Globalping test from the browser,
// through the same API as the CLI's `probe:test` (`POST /api/probe`): to our probe, or to an
// allowed target directly (`--host`). Void's starter look (style.css).
import { useState } from "react";
import { fetch } from "void/client";
import { SITE } from "../src/site";
import { ALLOWED_HOSTS } from "../src/targets";
import { failure } from "../src/ui/failure";
import type { Props } from "./index.server";

const REPO = "https://github.com/joeblew999/cloudflare-ping";
const PLAN = `${REPO}/blob/main/.claude/plans/2026-11-19-01-cloudflare-ping.md`;
const HOSTS = [SITE, ...ALLOWED_HOSTS];

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
    "vp run probe:test --",
    `--from ${from}`,
    `--path ${path}`,
    `--probes ${probes}`,
    ...(ours ? [] : [`--host ${host}`]),
  ].join(" ");

  return (
    <main className="starter">
      <section id="center" aria-labelledby="title">
        <div className="hero">
          <img className="base" src="/stack.svg" width="170" height="179" alt="" />
          <img className="framework" src="/react.svg" alt="" />
          <img className="void" src="/void.svg" alt="" />
        </div>
        <div className="starter-intro">
          <h1 id="title">cloudflare-ping</h1>
          <div className="starter-description">
            <p>
              Our own Globalping, run from Cloudflare&apos;s data centres. A Globalping probe is
              only the way in: it reaches our Worker in a data centre, and the Worker says which,
              and fetches from there.
            </p>
            <p>
              This page was served from <code>{here.colo ?? "?"}</code>
              {here.city ? ` (${here.city}, ${here.country ?? "?"})` : ""}.
            </p>
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section className="starter-demo" aria-labelledby="probe-title">
        <div className="demo-content">
          <h2 id="probe-title">Run a probe</h2>
          <p className="note">
            One Globalping test, from probes in a place (a country such as TH, a city, a network):
            to our probe (<code>/where</code> answers the data centre it reached;{" "}
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
            <label htmlFor="host">To</label>
            <select id="host" value={host} onChange={(event) => pickHost(event.target.value)}>
              {HOSTS.map((each) => (
                <option key={each} value={each}>
                  {each === SITE ? `${each} (our probe)` : each}
                </option>
              ))}
            </select>
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
            <button type="submit" disabled={pending || !email}>
              {pending ? "Waiting for Globalping…" : email ? "Run" : "Sign in to run"}
            </button>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="note">
              The same from a terminal: <code>{command}</code>
            </p>
          </form>
          {answer ? (
            <>
              <p className="note">
                Globalping measurement{" "}
                <a href={`https://api.globalping.io/v1/measurements/${answer.measurement}`}>
                  {answer.measurement}
                </a>
                , from {answer.from}, {answer.site}
                {answer.path}
              </p>
              <ul className="results">
                {answer.results.map((each) => (
                  <li key={`${each.city}-${each.network}-${each.ray}`}>
                    <strong>
                      {each.city}, {each.country}
                    </strong>
                    <span>
                      {each.network} (AS{each.asn})
                    </span>
                    {each.error ? <small className="different">{each.error}</small> : null}
                    <small className={each.same || !ours ? "same" : "different"}>
                      {ours
                        ? `${each.same ? "Same" : "Different"}: answered ${each.colo || "-"}, `
                        : ""}
                      cf-ray {each.ray ? <a href={`/trace/${each.ray}`}>{each.ray}</a> : "-"} · HTTP{" "}
                      {each.httpStatus ?? "-"} · {each.totalMs ?? "-"} ms
                      {each.isr ? ` · ${each.isr}` : ""}
                      {each.truncated ? " · cut off" : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section id="next-steps" aria-label="More">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>From a terminal</h2>
          <p>
            Everything here is a command too, through the same API. The first one shows a link and a
            code; approve it here, and the commands stay signed in.
          </p>
          <ul>
            <li>
              <a href={`${REPO}#readme`} target="_blank" rel="noreferrer">
                The commands
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#github-icon"></use>
          </svg>
          <h2>How it&apos;s built</h2>
          <p>One proof at a time</p>
          <ul>
            <li>
              <a href={PLAN} target="_blank" rel="noreferrer">
                The plan
              </a>
            </li>
            <li>
              <a href={REPO} target="_blank" rel="noreferrer">
                <svg className="button-icon" role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
