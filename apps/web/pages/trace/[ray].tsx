// Cloudflare's own record of one request, by its ray ID (`GET /api/trace/<ray id>`, the CLI's
// `trace`): which Worker ran it, where, for whom, and how long it took.
import type { Props } from "./[ray].server";

export default function TracePage({ ray, setUp, logs, error }: Props) {
  return (
    <main className="content vp-doc">
      <h1>Request {ray}</h1>
      <p className="lead">
        Cloudflare&apos;s own log of one request, found by its ray ID (its <code>cf-ray</code>):
        which Worker handled it, in which data centre, for a request from where, how it ended and
        how long it took. On a run, each fetch has two: the probe&apos;s request to our Worker, and
        our Worker&apos;s fetch of the target, which ran in the same data centre.
      </p>
      <p>
        The same from a terminal: <code>cloudflare-ping trace {ray}</code>
      </p>
      {!setUp ? (
        <div className="custom-block warning">
          <p className="custom-block-title">Not set up</p>
          <p>
            Reading Cloudflare&apos;s logs needs a Cloudflare API token that may read them
            (&quot;Workers Observability Read&quot;), kept as the app&apos;s{" "}
            <code>CLOUDFLARE_OBSERVABILITY_TOKEN</code> secret. The app has none yet, so this page
            can&apos;t show the log.
          </p>
        </div>
      ) : null}
      {error ? (
        <div className="custom-block danger" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {setUp && !error && logs.length === 0 ? (
        <p>No Workers log for this request in the last day (logs can take a minute).</p>
      ) : null}
      <ul className="results">
        {logs.map((log) => (
          <li key={`${log.at}-${log.service ?? ""}`} className="card">
            <p className="card-title">{log.service ?? "?"}</p>
            <p className="card-details">{log.message ?? ""}</p>
            <p className="card-details">
              Ran in {log.colo ?? "?"}, for a request from {log.from ?? "?"} ({log.city ?? "?"},{" "}
              {log.country ?? "?"}) · {log.outcome ?? "?"} · {log.wallTimeMs ?? "?"} ms wall,{" "}
              {log.cpuTimeMs ?? "?"} ms CPU ·{" "}
              {log.spans > 0 ? `${log.spans} trace spans` : "no trace spans"} · {log.at}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
