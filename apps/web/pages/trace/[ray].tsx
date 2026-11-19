// Cloudflare's own record of one request, by its ray ID (`GET /api/trace/<ray id>`, the CLI's
// `trace`): which Worker ran it, where, for whom, and how long it took.
import type { Props } from "./[ray].server";

export default function TracePage({ ray, setUp, logs, error }: Props) {
  return (
    <main className="content vp-doc">
      <h1>Request {ray}</h1>
      <p>
        The same from a terminal: <code>cloudflare-ping trace {ray}</code>
      </p>
      {!setUp ? (
        <div className="custom-block warning">
          <p className="custom-block-title">Not set up</p>
          <p>
            The app needs a Cloudflare API token with &quot;Workers Observability Read&quot;, as its{" "}
            <code>CLOUDFLARE_OBSERVABILITY_TOKEN</code> secret.
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
