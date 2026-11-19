// One run and its recorded fetches (`GET /api/runs/<id>`, the CLI's `ping:show`). For its first
// minute and a half it asks again every 2 seconds, as background fetches arrive (`ping:run` does
// the same).
import { useEffect, useState } from "react";
import { fetch } from "void/client";
import type { Props } from "./[id].server";

const FOLLOW_MS = 90_000;

export default function RunPage({ run, fetches: first }: Props) {
  const [rows, setRows] = useState(first);

  useEffect(() => {
    const until = Date.parse(run.createdAt) + FOLLOW_MS;
    if (Date.now() > until) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (Date.now() > until) {
        clearInterval(timer);
        return;
      }
      void fetch("/api/runs/[id]", { params: { id: run.id } }).then(
        (fresh) => setRows(fresh.fetches),
        () => undefined,
      );
    }, 2000);
    return () => clearInterval(timer);
  }, [run.id, run.createdAt]);

  return (
    <main className="starter">
      <section className="starter-demo" aria-labelledby="run-title">
        <div className="demo-content">
          <h1 id="run-title">A run</h1>
          <p>
            <a href={run.target}>{run.target}</a>
          </p>
          <p className="note">
            From {run.fromPlace ?? "?"}, {run.probes ?? "?"} probes × {run.repeat ?? 1}{" "}
            {run.background === null ? "?" : run.background ? "in the background" : "inline"},
            started {run.createdAt}.
            {run.measurement ? (
              <>
                {" "}
                Globalping measurement{" "}
                <a href={`https://api.globalping.io/v1/measurements/${run.measurement}`}>
                  {run.measurement}
                </a>
                .
              </>
            ) : null}
          </p>
          <p className="note">
            The same from a terminal: <code>vp run ping:show -- {run.id}</code>
          </p>
          <h2>{rows.length} fetches recorded</h2>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Our Worker</th>
                  <th>Target ran in</th>
                  <th>#</th>
                  <th>Cache</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Logs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.colo ?? "?"}</td>
                    <td className={row.targetColo === row.colo ? "same" : "different"}>
                      {row.targetColo ?? "?"}
                    </td>
                    <td>{row.attempt}</td>
                    <td>{row.isr ?? "-"}</td>
                    <td>{row.ms} ms</td>
                    <td>{row.status}</td>
                    <td>
                      <a href={`/trace/${row.ray}`}>ours</a>
                      {row.targetRay ? (
                        <>
                          {" · "}
                          <a href={`/trace/${row.targetRay}`}>target</a>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
