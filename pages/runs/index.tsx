// Runs: start one (`POST /api/runs`, the CLI's `ping:run`) and the newest ones (`GET /api/runs`,
// the CLI's `ping:runs`). A run sends one Globalping test to `/run`, and each fetch it makes is
// recorded (plan step 5).
import { useState } from "react";
import { fetch } from "void/client";
import { ALLOWED_HOSTS, DEFAULT_TARGET } from "../../src/targets";
import { failure } from "../../src/ui/failure";
import type { Props } from "./index.server";

const HOSTS = [...ALLOWED_HOSTS];
const DEFAULT = new URL(DEFAULT_TARGET);

export default function RunsPage({ email, runs }: Props) {
  const [host, setHost] = useState(DEFAULT.hostname);
  const [path, setPath] = useState(DEFAULT.pathname);
  const [from, setFrom] = useState("TH");
  const [probes, setProbes] = useState("2");
  const [repeat, setRepeat] = useState("1");
  const [background, setBackground] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const target = `https://${host}${path}`;

  async function start() {
    setPending(true);
    setError("");
    try {
      const started = await fetch("/api/runs", {
        method: "POST",
        body: {
          target,
          from,
          probes: Number(probes),
          repeat: Number(repeat),
          background,
        },
      });
      window.location.assign(`/runs/${started.id}`);
    } catch (caught) {
      setError(failure(caught));
      setPending(false);
    }
  }

  const command = [
    "vp run ping:run --",
    `--target ${target}`,
    `--from ${from}`,
    `--probes ${probes}`,
    `--repeat ${repeat}`,
    ...(background ? [] : ["--inline"]),
  ].join(" ");

  return (
    <main className="starter">
      <section className="starter-demo" aria-labelledby="start-title">
        <div className="demo-content">
          <h1 id="start-title">Runs</h1>
          <p className="note">
            A run sends one Globalping test from probes in a place to our <code>/run</code>, which
            fetches the target from each data centre the probes reach and records every fetch. In
            the background, the test only has to reach the data centre; the fetches come after.
          </p>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            <div className="form-row">
              <label>
                Target
                <select value={host} onChange={(event) => setHost(event.target.value)}>
                  {HOSTS.map((each) => (
                    <option key={each} value={each}>
                      {each}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Path
                <input value={path} onChange={(event) => setPath(event.target.value)} required />
              </label>
            </div>
            <div className="form-row">
              <label>
                From
                <input value={from} onChange={(event) => setFrom(event.target.value)} required />
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
              <label>
                Fetches each
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={background}
                onChange={(event) => setBackground(event.target.checked)}
              />
              In the background
            </label>
            <button type="submit" disabled={pending || !email}>
              {pending ? "Starting…" : email ? "Start a run" : "Sign in to start a run"}
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
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section className="starter-demo" aria-labelledby="list-title">
        <div className="demo-content">
          <h2 id="list-title">The newest</h2>
          <p className="note">
            The same from a terminal: <code>vp run ping:runs</code>
          </p>
          {runs.length === 0 ? (
            <p>No runs yet.</p>
          ) : (
            <ul className="results">
              {runs.map((run) => (
                <li key={run.id}>
                  <strong>
                    <a href={`/runs/${run.id}`}>{new URL(run.target).pathname}</a>
                  </strong>
                  <span>
                    {run.fromPlace ?? "?"} · {run.probes ?? "?"} probes × {run.repeat ?? 1} ·{" "}
                    {run.fetches} fetches recorded
                  </span>
                  <small>
                    {run.createdAt} · {run.id}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
