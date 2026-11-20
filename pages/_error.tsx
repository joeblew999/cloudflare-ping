// A page that failed, in the app's frame (Void's error pages: guide/pages-routing/errors.md). In
// production the message is Void's generic one unless a loader threw an HTTPException with its
// own; the details are in the Worker's logs. "Try again" re-runs the page's loader.
import { Link, useRouter, type ErrorPageProps } from "@void/react";

export default function ErrorPage({ error }: ErrorPageProps) {
  const router = useRouter();
  return (
    <main className="content vp-doc">
      <h1>Something went wrong ({error.status})</h1>
      <div className="custom-block danger" role="alert">
        <p>{error.message}</p>
      </div>
      <p>
        <button type="button" className="button alt" onClick={() => void router.refresh()}>
          Try again
        </button>
      </p>
      <p>
        <Link href="/">Probe</Link> · <Link href="/runs">Runs</Link> · <a href="/docs/">Docs</a>
      </p>
    </main>
  );
}
