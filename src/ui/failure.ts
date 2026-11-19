// What to tell someone when an API call from a page fails (the pages' one message for it).
import { FetchError } from "void/client";

export function failure(caught: unknown): string {
  if (caught instanceof FetchError) {
    if (caught.status === 401) {
      return "Sign in first.";
    }
    const said = typeof caught.data === "string" ? caught.data : JSON.stringify(caught.data);
    return `Failed (${caught.status})${said ? `: ${said}` : "."}`;
  }
  return caught instanceof Error ? caught.message : "Failed.";
}
