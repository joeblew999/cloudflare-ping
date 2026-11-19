// The app's home page: where this page was served from, and a probe run from the browser through
// the same API the CLI uses (`POST /api/probe`, plan step 6). Void's starter look (style.css).
import { useState } from "react";
import { FetchError, auth, fetch } from "void/client";
import type { Props } from "./index.server";
import "./style.css";

const REPO = "https://github.com/joeblew999/cloudflare-ping";
const PLAN = `${REPO}/blob/main/.claude/plans/2026-11-19-01-cloudflare-ping.md`;

const runProbe = (body: { from: string; path: string; probes: number }) =>
  fetch("/api/probe", { method: "POST", body });
type Answer = Awaited<ReturnType<typeof runProbe>>;

export default function HomePage({ email, here }: Props) {
  const [from, setFrom] = useState("TH");
  const [path, setPath] = useState("/where");
  const [probes, setProbes] = useState("2");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function run() {
    setPending(true);
    setError("");
    try {
      setAnswer(await runProbe({ from, path, probes: Number(probes) }));
    } catch (caught) {
      if (caught instanceof FetchError) {
        setError(caught.status === 401 ? "Sign in first." : `Failed (${caught.status}).`);
      } else {
        setError(caught instanceof Error ? caught.message : "Failed.");
      }
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    await auth.signOut();
    window.location.reload();
  }

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
              only the way in: it reaches our Worker in a data centre, and the Worker says which.
            </p>
            <p>
              This page was served from <code>{here.colo ?? "?"}</code>
              {here.city ? ` (${here.city}, ${here.country ?? "?"})` : ""}.
            </p>
            <p>
              {email ? (
                <>
                  Signed in as {email}.{" "}
                  <button type="button" className="link-button" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <a href="/login?next=/">Sign in</a> to run probes.
                </>
              )}
            </p>
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section className="starter-demo" aria-labelledby="probe-title">
        <div className="demo-content">
          <h2 id="probe-title">Run a probe</h2>
          <p className="note">
            Globalping sends a test from probes in a place (a country such as TH, a city, a network)
            to this app&apos;s <code>/where</code>, and each answers the data centre it reached. It
            spends Globalping tests, so it needs you signed in.
          </p>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
          >
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
              {pending ? "Waiting for Globalping…" : "Run"}
            </button>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="note">
              The same from a terminal:{" "}
              <code>
                vp run probe:test -- --from {from} --path {path} --probes {probes}
              </code>
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
                    <small className={each.same ? "same" : "different"}>
                      {each.same ? "Same" : "Different"}: answered {each.colo || "-"}, cf-ray{" "}
                      {each.rayColo || "-"} · HTTP {each.httpStatus ?? "-"} · {each.totalMs ?? "-"}{" "}
                      ms
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
            The same API. The first run shows a link and a code; approve it here, and the command
            stays signed in.
          </p>
          <ul>
            <li>
              <a href={`${REPO}#readme`} target="_blank" rel="noreferrer">
                How to use it
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
