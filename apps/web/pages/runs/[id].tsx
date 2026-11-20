// One run and its recorded fetches (src/commands/runs.ts, as `GET /api/runs/<id>`; the CLI's
// `show`). Fetches still arriving (a run in the background) come in live: the page follows the
// run's topic on Void's live stream (src/live.ts), where `/run` publishes each fetch it records.
import { Link, useRouter } from "@void/react";
import { useEffect, useEffectEvent, useState } from "react";
import { connectLiveStream } from "void/live/client";
import { routeUrl } from "void/routes";
import type { Props } from "./[id].server";

type Row = Props["fetches"][number];

// The rows from the loader and from the live stream together, each once, in recorded order.
const merged = (a: Array<Row>, b: Array<Row>) =>
  [...new Map([...a, ...b].map((row) => [row.id, row])).values()].sort((x, y) => x.id - y.id);

export default function RunPage({ run, fetches: first }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(first);
  const [error, setError] = useState(run.error);

  useEffect(() => setRows((now) => merged(first, now)), [first]);
  useEffect(() => setError(run.error), [run.error]);
  // Not a reason to subscribe again: the router is a new object after each refresh.
  const caughtUp = useEffectEvent(() => void router.refresh());

  useEffect(() => {
    const stream = connectLiveStream("/live", { retryDelay: 1_000 });
    const subscribed = stream.subscribe<Row | { error: string }>({
      id: "run",
      topic: `run:${run.id}`,
      onEvent({ data }) {
        if ("id" in data) {
          setRows((now) => merged(now, [data]));
        } else {
          setError(data.error);
        }
      },
    });
    // Anything recorded before the subscription opened: the loader again, once.
    void subscribed.then(caughtUp, () => undefined);
    return () => {
      void subscribed.then(
        (unsubscribe) => unsubscribe(),
        () => undefined,
      );
      stream.close();
    };
  }, [run.id]);

  const mode = run.background === null ? "?" : run.background ? "in the background" : "inline";

  return (
    <main className="content wide vp-doc">
      <p>
        <Link href="/runs">← Runs</Link>
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
      {error ? (
        <div className="custom-block danger">
          <p className="custom-block-title">
            {run.measurement ? "Something went wrong" : "This run didn't start"}
          </p>
          <p>{error}</p>
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
              <th>Cloudflare&apos;s log of</th>
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
                  {/* A request without a cf-ray (only `vp dev`'s) has no log to link to. */}
                  {row.ray ? (
                    <Link href={routeUrl("/trace/[ray]", { params: { ray: row.ray } })}>
                      the probe&apos;s request
                    </Link>
                  ) : (
                    "-"
                  )}
                  {row.targetRay ? (
                    <>
                      {" · "}
                      <Link href={routeUrl("/trace/[ray]", { params: { ray: row.targetRay } })}>
                        our Worker&apos;s fetch
                      </Link>
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
