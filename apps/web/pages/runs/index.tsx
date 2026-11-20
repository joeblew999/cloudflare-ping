// Runs: start one (Void's page action, pages/runs/index.server.ts, running src/commands/run.ts as
// `POST /api/runs` does; the CLI's `run`) and the newest ones (the CLI's `runs`). A run sends one
// Globalping test to `/run`, and each fetch it makes is recorded (plan step 5).
import { Form, Link, useForm } from "@void/react";
import { Suspense, use, useState } from "react";
import { routeUrl } from "void/routes";
import { limitsLine } from "@cloudflare-ping/shared/limits";
import { ALLOWED_HOSTS, DEFAULT_TARGET } from "@cloudflare-ping/shared/targets";
import type { Props } from "./index.server";

const HOSTS = [...ALLOWED_HOSTS];
const DEFAULT = new URL(DEFAULT_TARGET);

// Globalping's limit (the CLI's `limits`), when the loader has it.
function Quota({ limits }: Pick<Props, "limits">) {
  const found = use(limits);
  return <>{found.ok ? limitsLine(found.found) : found.error}</>;
}

export default function RunsPage({ email, runs, limits }: Props) {
  const [host, setHost] = useState(DEFAULT.hostname);
  const [path, setPath] = useState(DEFAULT.pathname);
  const form = useForm(
    "/runs",
    { target: DEFAULT_TARGET, from: "TH", probes: 2, repeat: 1, background: true },
    { throwOnError: false },
  );

  function setTarget(nextHost: string, nextPath: string) {
    setHost(nextHost);
    setPath(nextPath);
    form.setData("target", `https://${nextHost}${nextPath}`);
  }

  const command = [
    "cloudflare-ping run",
    `--target ${form.data.target}`,
    `--from ${form.data.from}`,
    `--probes ${form.data.probes}`,
    `--repeat ${form.data.repeat}`,
    ...(form.data.background ? [] : ["--inline"]),
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
          <Suspense fallback="Asking Globalping how many tests are left…">
            <Quota limits={limits} />
          </Suspense>{" "}
          The same from a terminal: <code>cloudflare-ping limits</code>
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
          <div className="form-row">
            <label>
              Target
              <select value={host} onChange={(event) => setTarget(event.target.value, path)}>
                {HOSTS.map((each) => (
                  <option key={each} value={each}>
                    {each}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Path
              <input
                value={path}
                onChange={(event) => setTarget(host, event.target.value)}
                required
              />
              {form.errors.target ? <span className="different">{form.errors.target}</span> : null}
            </label>
          </div>
          <div className="form-row">
            <label>
              From
              <input
                value={form.data.from}
                onChange={(event) => form.setData("from", event.target.value)}
                required
              />
              {form.errors.from ? <span className="different">{form.errors.from}</span> : null}
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
              {form.errors.probes ? <span className="different">{form.errors.probes}</span> : null}
            </label>
            <label>
              Fetches each
              <input
                type="number"
                min={1}
                max={5}
                value={form.data.repeat}
                onChange={(event) => form.setData("repeat", Number(event.target.value))}
                required
              />
              {form.errors.repeat ? <span className="different">{form.errors.repeat}</span> : null}
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.data.background}
              onChange={(event) => form.setData("background", event.target.checked)}
            />
            In the background
          </label>
          <div className="form-actions">
            <button type="submit" className="button brand" disabled={form.pending || !email}>
              {form.pending ? "Starting…" : email ? "Start a run" : "Sign in to start a run"}
            </button>
          </div>
        </Form>
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
                <Link className="card" href={routeUrl("/runs/[id]", { params: { id: run.id } })}>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
