// Where the CLI's sign-in is approved (cli/sign-in.ts): the command shows a link to this page
// with its code; approving it here, signed in, gives the command its token.
import { useState } from "react";
import type { Props } from "./device.server";
import "./style.css";

export default function DevicePage({ email, userCode }: Props) {
  const [code, setCode] = useState(userCode);
  const [outcome, setOutcome] = useState("");

  async function decide(choice: "approve" | "deny") {
    // Better Auth first ties the code to this signed-in session, and only then takes a decision.
    const claimed = await fetch(`/api/auth/device?user_code=${encodeURIComponent(code)}`);
    if (!claimed.ok) {
      setOutcome(`That code isn't waiting (${claimed.status}): ${await claimed.text()}`);
      return;
    }
    const response = await fetch(`/api/auth/device/${choice}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userCode: code }),
    });
    if (!response.ok) {
      setOutcome(`Failed (${response.status}): ${await response.text()}`);
      return;
    }
    setOutcome(
      choice === "approve"
        ? "Approved: the command is signed in. This page can be closed."
        : "Denied: the command isn't signed in.",
    );
  }

  return (
    <main className="starter">
      <section id="center" aria-labelledby="title">
        <div className="starter-intro">
          <h1 id="title">Sign in a command</h1>
          <div className="starter-description">
            <p>
              Signed in to <a href="/">cloudflare-ping</a> as {email}. Approve only a code that a
              command you just ran is showing.
            </p>
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section className="starter-demo" aria-label="Approve">
        <div className="demo-content">
          <div className="form">
            <label htmlFor="code">Code</label>
            <input id="code" value={code} onChange={(event) => setCode(event.target.value)} />
            <div className="form-row">
              <button type="button" onClick={() => void decide("approve")}>
                Approve
              </button>
              <button type="button" onClick={() => void decide("deny")}>
                Deny
              </button>
            </div>
            {outcome ? <p role="status">{outcome}</p> : null}
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
