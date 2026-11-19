// Where the CLI's sign-in is approved (scripts/sign-in.ts): the command shows a link to this page
// with its code; approving it here, signed in, gives the command its token.
import { useState } from "react";
import type { Props } from "./device.server";
import "./auth.css";

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
    <main className="auth">
      <h1>Sign in a command</h1>
      <p>Signed in as {email}. Approve only a code that a command you just ran is showing.</p>
      <label>
        Code
        <input value={code} onChange={(event) => setCode(event.target.value)} />
      </label>
      <div className="buttons">
        <button type="button" onClick={() => void decide("approve")}>
          Approve
        </button>
        <button type="button" onClick={() => void decide("deny")}>
          Deny
        </button>
      </div>
      {outcome ? <p role="status">{outcome}</p> : null}
    </main>
  );
}
