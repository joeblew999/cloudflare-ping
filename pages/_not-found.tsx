// No such page, or no such run (a loader's 404), in the app's frame (Void's error pages:
// guide/pages-routing/errors.md).
import { Link, type ErrorPageProps } from "@void/react";

export default function NotFoundPage({ error }: ErrorPageProps) {
  return (
    <main className="content vp-doc">
      <h1>Not found</h1>
      <p className="lead">{error.message || "There's nothing here."}</p>
      <p>
        <Link href="/">Probe</Link> · <Link href="/runs">Runs</Link> · <a href="/docs/">Docs</a>
      </p>
    </main>
  );
}
