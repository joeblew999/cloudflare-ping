// Every page's frame, as the docs' (VitePress's bar): the app's name, what it does, one link each
// (the same as the CLI's commands: README), the docs, light or dark, and who's signed in
// (middleware/01.auth.ts).
import { Link, useRouter, useShared } from "@void/react";
import { useEffect, useState } from "react";
import { auth } from "void/client";
import { routeUrl } from "void/routes";
import { APPEARANCE_KEY } from "../src/appearance";
import "./style.css";

// Light or dark (VPSwitchAppearance): `.dark` on <html>, saved as VitePress saves it.
function AppearanceSwitch() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(APPEARANCE_KEY, next ? "dark" : "light");
    } catch {
      // Not saved (private browsing): it still holds for this page.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={dark}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
    >
      <span className="switch-check" aria-hidden="true">
        {dark ? "☾" : "☀"}
      </span>
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { auth: who } = useShared();
  // Signing in comes back here.
  const { path } = useRouter();

  async function signOut() {
    await auth.signOut();
    window.location.reload();
  }

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-title">
            cloudflare-ping
          </Link>
          <nav className="nav-menu" aria-label="Main">
            {/* Void marks the current one (`data-void-active`, style.css); Runs stays marked on a
                run's own page. */}
            <Link href="/" className="nav-link">
              Probe
            </Link>
            <Link href="/runs" className="nav-link" activeMatch="prefix">
              Runs
            </Link>
            {/* The docs are their own site (VitePress, apps/docs), so a plain link. */}
            <a href="/docs/" className="nav-link">
              Docs
            </a>
          </nav>
          <AppearanceSwitch />
          <span className="nav-who">
            {who.email ? (
              <>
                {who.email}
                <button type="button" className="link-button" onClick={() => void signOut()}>
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href={routeUrl("/login", { query: { next: path } })}
                className="button alt small"
              >
                Sign in
              </Link>
            )}
          </span>
        </div>
      </header>
      {children}
    </>
  );
}
