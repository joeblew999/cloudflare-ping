// What to tell someone when an API call fails: the pages' and the CLI's one message for it.
import { FetchError } from "void/client";

// The words in an error's answer: Void's text, or a JSON answer's `message`.
function said(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (typeof data === "object" && data !== null && "message" in data) {
    return typeof data.message === "string" ? data.message : JSON.stringify(data.message);
  }
  return data === undefined ? "" : JSON.stringify(data);
}

export function failure(caught: unknown): string {
  if (caught instanceof FetchError) {
    if (caught.status === 401) {
      return "Sign in first.";
    }
    const words = said(caught.data);
    return `Failed (${caught.status})${words ? `: ${words}` : "."}`;
  }
  return caught instanceof Error ? caught.message : "Failed.";
}
