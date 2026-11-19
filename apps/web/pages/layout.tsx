// Every page's frame: what the app does, one link each (the same as the CLI's tasks: README), and
// who's signed in (middleware/01.auth.ts).
import { Link, useShared } from "@void/react";
import { auth } from "void/client";
import "./style.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { auth: who } = useShared();

  async function signOut() {
    await auth.signOut();
    window.location.reload();
  }

  return (
    <>
      <header className="nav">
        <Link href="/" className="brand">
          cloudflare-ping
        </Link>
        <nav aria-label="Main">
          <Link href="/">Probe</Link>
          <Link href="/runs">Runs</Link>
          {/* The docs are their own site (VitePress, docs/), so a plain link, not Void's. */}
          <a href="/docs/">Docs</a>
        </nav>
        <span className="who">
          {who.email ? (
            <>
              {who.email}{" "}
              <button type="button" className="link-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <a href="/login?next=/">Sign in</a>
          )}
        </span>
      </header>
      {children}
    </>
  );
}
