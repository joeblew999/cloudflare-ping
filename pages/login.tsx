// Sign in, or make an account (only for the addresses the app allows: auth.ts).
import { useState } from "react";
import { auth } from "void/client";
import type { Props } from "./login.server";
import "./style.css";

export default function LoginPage({ next }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(kind: "sign-in" | "sign-up") {
    setPending(true);
    setError("");
    const result =
      kind === "sign-in"
        ? await auth.signIn.email({ email, password })
        : await auth.signUp.email({ email, password, name: email });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? `Failed (${result.error.status})`);
      return;
    }
    window.location.assign(next);
  }

  return (
    <main className="starter">
      <section id="center" aria-labelledby="title">
        <div className="starter-intro">
          <h1 id="title">Sign in</h1>
          <div className="starter-description">
            <p>
              To run probes from <a href="/">cloudflare-ping</a>, and to approve a command&apos;s
              sign-in. Only the addresses this app allows can make an account.
            </p>
          </div>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <section className="starter-demo" aria-label="Sign in">
        <div className="demo-content">
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("sign-in");
            }}
          >
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="form-row">
              <button type="submit" disabled={pending}>
                Sign in
              </button>
              <button type="button" disabled={pending} onClick={() => void submit("sign-up")}>
                Make an account
              </button>
            </div>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </section>
      <div className="ticks" aria-hidden="true"></div>
      <div id="spacer" aria-hidden="true"></div>
    </main>
  );
}
