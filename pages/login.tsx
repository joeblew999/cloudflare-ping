// Sign in, or make an account (only for the addresses the app allows: auth.ts). Also the first
// page of an MCP client's sign-in: then signing in carries on to /consent (src/auth-client.ts).
import { useState } from "react";
import { oauthAuth } from "../src/auth-client";
import type { Props } from "./login.server";
import "./style.css";

export default function LoginPage({ next, forAgent }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(kind: "sign-in" | "sign-up") {
    setPending(true);
    setError("");
    const result =
      kind === "sign-in"
        ? await oauthAuth.signIn.email({ email, password })
        : await oauthAuth.signUp.email({ email, password, name: email });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? `Failed (${result.error.status})`);
      return;
    }
    // For an agent, the answer says where its sign-in goes next, and the client goes there.
    if (!forAgent) {
      window.location.assign(next);
    }
  }

  return (
    <main className="content vp-doc">
      <h1>Sign in</h1>
      <p className="lead">
        To run probes from <a href="/">cloudflare-ping</a>, and to approve a command&apos;s sign-in.
        Only the addresses this app allows can make an account.
      </p>
      {forAgent ? (
        <div className="custom-block tip">
          <p className="custom-block-title">An agent is asking to use cloudflare-ping</p>
          <p>Sign in, and you&apos;ll be asked whether to allow it, as you.</p>
        </div>
      ) : null}
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("sign-in");
        }}
      >
        <label>
          Email
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="button brand" disabled={pending}>
            Sign in
          </button>
          <button
            type="button"
            className="button alt"
            disabled={pending}
            onClick={() => void submit("sign-up")}
          >
            Make an account
          </button>
        </div>
      </form>
      {error ? (
        <div className="custom-block danger" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
    </main>
  );
}
