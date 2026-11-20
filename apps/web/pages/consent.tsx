// Allow an MCP client to use cloudflare-ping as you, or not (pages/consent.server.ts). The answer
// goes to Void's auth (`POST /api/auth/oauth2/consent`), with the agent's signed request, which
// src/auth-client.ts adds; the browser then goes back to the agent, with or without a token.
import { useState } from "react";
import { oauthAuth } from "../src/auth-client";
import type { Props } from "./consent.server";

// What each OAuth scope gives the agent, in words.
const SCOPES: Record<string, string> = {
  openid: "Know which account it signed in as",
  profile: "See your account's name",
  email: "See your account's email address",
  offline_access: "Stay signed in, until you sign it out",
};

export default function ConsentPage({ email, agent, scopes }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function answer(accept: boolean) {
    setPending(true);
    setError("");
    const result = await oauthAuth.$fetch("/oauth2/consent", { method: "POST", body: { accept } });
    if (result.error) {
      setPending(false);
      setError(result.error.message ?? `Failed (${result.error.status})`);
    }
  }

  return (
    <main className="content vp-doc">
      <h1>Allow {agent.name}?</h1>
      <p className="lead">
        {agent.uri ? <a href={agent.uri}>{agent.name}</a> : agent.name} is asking to use
        cloudflare-ping as <strong>{email}</strong>: to see runs and your Globalping tests left, and
        to start runs and tests, which spend them. It can do what the CLI can, through the
        app&apos;s MCP tools (<code>/mcp</code>), and nothing else.
      </p>
      {scopes.length > 0 ? (
        <ul>
          {scopes.map((scope) => (
            <li key={scope}>{SCOPES[scope] ?? scope}</li>
          ))}
        </ul>
      ) : null}
      <div className="form-actions">
        <button
          type="button"
          className="button brand"
          disabled={pending}
          onClick={() => void answer(true)}
        >
          Allow
        </button>
        <button
          type="button"
          className="button alt"
          disabled={pending}
          onClick={() => void answer(false)}
        >
          Deny
        </button>
      </div>
      {error ? (
        <div className="custom-block danger" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
    </main>
  );
}
