// Sign in, or make an account (only for the addresses the app allows: auth.ts).
import { useState } from "react";
import { auth } from "void/client";
import type { Props } from "./login.server";
import "./auth.css";

export default function LoginPage({ next }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(kind: "sign-in" | "sign-up") {
    setError("");
    const result =
      kind === "sign-in"
        ? await auth.signIn.email({ email, password })
        : await auth.signUp.email({ email, password, name: email });
    if (result.error) {
      setError(result.error.message ?? `Failed (${result.error.status})`);
      return;
    }
    window.location.assign(next);
  }

  return (
    <main className="auth">
      <h1>cloudflare-ping</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit("sign-in");
        }}
      >
        <label>
          Email
          <input
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
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="buttons">
          <button type="submit">Sign in</button>
          <button type="button" onClick={() => void submit("sign-up")}>
            Make an account
          </button>
        </div>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
