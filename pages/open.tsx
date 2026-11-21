// A browser signed in by `cloudflare-ping open` (plan 2026-11-21-02): the CLI, already signed in,
// asked for a one-time token (auth.ts, Better Auth's `oneTimeToken`) and opened this page with it
// in the fragment. The page hands it to Better Auth, which sets the session cookie (the CLI's own
// session), then goes on to the page asked for. The token works once, within 3 minutes.
import { useEffect, useState } from "react";
import { oauthAuth } from "../src/auth-client";
import type { Props } from "./open.server";
import "./style.css";

export default function OpenPage({ to }: Props) {
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    // Out of the address bar and the history at once: it's used up either way.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!token) {
      setFailed("This link has no sign-in token.");
      return;
    }
    void oauthAuth.oneTimeToken.verify({ token }).then((result) => {
      if (result.error) {
        setFailed(result.error.message ?? `Failed (${result.error.status})`);
      } else {
        window.location.replace(to);
      }
    });
  }, [to]);

  return (
    <main className="content vp-doc">
      <h1>Signing in</h1>
      {failed ? (
        <div className="custom-block warning">
          <p className="custom-block-title">Not signed in: {failed}</p>
          <p>
            A link from <code>cloudflare-ping open</code> works once, within 3 minutes: run it
            again, or <a href={`/login?next=${encodeURIComponent(to)}`}>sign in here</a>.
          </p>
        </div>
      ) : (
        <p className="lead">
          Signing this browser in as <code>cloudflare-ping open</code> asked, then on to{" "}
          <code>{to}</code>.
        </p>
      )}
    </main>
  );
}
