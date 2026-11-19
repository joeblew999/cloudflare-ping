// Runs: start one (`POST /api/runs`, the CLI's `run`) and the newest ones (`GET /api/runs`, the
// CLI's `runs`). A run sends one Globalping test to `/run`, and each fetch it makes is recorded
// (plan step 5).
import { useEffect, useState } from "react";
import { fetch } from "void/client";
import { failure } from "@cloudflare-ping/shared/failure";
import { limitsLine } from "@cloudflare-ping/shared/limits";
import { ALLOWED_HOSTS, DEFAULT_TARGET } from "@cloudflare-ping/shared/targets";
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
  // Globalping's limit, asked after the page shows (`GET /api/limits`, the CLI's `limits`).
  const [quota, setQuota] = useState("");
  const target = `https://${host}${path}`;

  useEffect(() => {
    void fetch("/api/limits").then(
      (found) => setQuota(limitsLine(found)),
      (caught: unknown) => setQuota(failure(caught)),
    );
  }, []);

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
    "cloudflare-ping run",
    `--target ${target}`,
    `--from ${from}`,
    `--probes ${probes}`,
    `--repeat ${repeat}`,
    ...(background ? [] : ["--inline"]),
  ].join(" ");

  return (
    <main className="content vp-doc">
      <section aria-labelledby="start-title">
        <h1 id="start-title">Runs</h1>
        <p className="lead">
          A run sends one Globalping test from probes in a place to our <code>/run</code>, which
          fetches the target from each data centre the probes reach and records every fetch. In the
          background, the test only has to reach the data centre; the fetches come after.
        </p>
        <p>
          {quota || "Asking Globalping how many tests are left…"} The same from a terminal:{" "}
          <code>cloudflare-ping limits</code>
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
          <div className="form-actions">
            <button type="submit" className="button brand" disabled={pending || !email}>
              {pending ? "Starting…" : email ? "Start a run" : "Sign in to start a run"}
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
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title">The newest</h2>
        <p>
          The same from a terminal: <code>cloudflare-ping runs</code>
        </p>
        {runs.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <ul className="results">
            {runs.map((run) => (
              <li key={run.id}>
                <a className="card" href={`/runs/${run.id}`}>
                  <p className="card-title">{new URL(run.target).pathname}</p>
                  <p className="card-details">
                    From {run.fromPlace ?? "?"} · {run.probes ?? "?"} probes × {run.repeat ?? 1} ·{" "}
                    {run.fetches} fetches recorded
                  </p>
                  {run.error ? (
                    <p className="card-details different">
                      {run.measurement ? "Went wrong" : "Didn't start"}: {run.error}
                    </p>
                  ) : null}
                  <p className="card-details">
                    {run.createdAt.slice(0, 16).replace("T", " ")} · {run.id}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
