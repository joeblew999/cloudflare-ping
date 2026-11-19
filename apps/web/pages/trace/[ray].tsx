// Cloudflare's own record of one request, by its ray ID (`GET /api/trace/<ray id>`, the CLI's
// `probe:trace`): which Worker ran it, where, for whom, and how long it took.
import type { Props } from "./[ray].server";

export default function TracePage({ ray, setUp, logs, error }: Props) {
  return (
    <main className="starter">
      <section className="starter-demo" aria-labelledby="trace-title">
        <div className="demo-content">
          <h1 id="trace-title">Request {ray}</h1>
          <p className="note">
            The same from a terminal: <code>vp run probe:trace -- {ray}</code>
          </p>
          {!setUp ? (
            <p className="error">
              Not set up: the app needs a Cloudflare API token with &quot;Workers Observability
              Read&quot;, as its <code>CLOUDFLARE_OBSERVABILITY_TOKEN</code> secret.
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {setUp && !error && logs.length === 0 ? (
            <p>No Workers log for this request in the last day (logs can take a minute).</p>
          ) : null}
          <ul className="results">
            {logs.map((log) => (
              <li key={`${log.at}-${log.service ?? ""}`}>
                <strong>{log.service ?? "?"}</strong>
                <span>{log.message ?? ""}</span>
                <small>
                  Ran in {log.colo ?? "?"}, for a request from {log.from ?? "?"} ({log.city ?? "?"},{" "}
                  {log.country ?? "?"}) · {log.outcome ?? "?"} · {log.wallTimeMs ?? "?"} ms wall,{" "}
                  {log.cpuTimeMs ?? "?"} ms CPU ·{" "}
                  {log.spans > 0 ? `${log.spans} trace spans` : "no trace spans"} · {log.at}
                </small>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
