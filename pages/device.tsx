// Where the CLI's sign-in is approved (packages/cli/sign-in.ts): the command shows a link to this page
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
    <main className="content vp-doc">
      <h1>Sign in a command</h1>
      <p className="lead">
        Signed in to <a href="/">cloudflare-ping</a> as {email}. Approve only a code that a command
        you just ran is showing.
      </p>
      <div className="form">
        <label>
          Code
          <input id="code" value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="button brand" onClick={() => void decide("approve")}>
            Approve
          </button>
          <button type="button" className="button alt" onClick={() => void decide("deny")}>
            Deny
          </button>
        </div>
      </div>
      {outcome ? (
        <div className="custom-block tip" role="status">
          <p>{outcome}</p>
        </div>
      ) : null}
    </main>
  );
}
