// One run and its recorded fetches (`GET /api/runs/<id>`, the CLI's `show`). For its first minute
// and a half it asks again every 2 seconds, as background fetches arrive (the CLI's `run` does the
// same).
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

  const mode = run.background === null ? "?" : run.background ? "in the background" : "inline";

  return (
    <main className="content wide vp-doc">
      <p>
        <a href="/runs">← Runs</a>
      </p>
      <h1>A run</h1>
      <p className="lead">
        <a href={run.target}>{run.target}</a>
      </p>
      <p>
        From {run.fromPlace ?? "?"}, {run.probes ?? "?"} probes × {run.repeat ?? 1} {mode}, started{" "}
        {run.createdAt.slice(0, 19).replace("T", " ")}.
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
      {run.error ? (
        <div className="custom-block danger">
          <p className="custom-block-title">This run didn&apos;t start</p>
          <p>{run.error}</p>
        </div>
      ) : null}
      <p>
        The same from a terminal: <code>cloudflare-ping show {run.id}</code>
      </p>
      <h2>{rows.length} fetches recorded</h2>
      <div className="table-scroll">
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
    </main>
  );
}
