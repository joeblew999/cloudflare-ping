// Where a page sends someone next (`?next=` on /login, `?to=` on /open): only a path on this site,
// so a link can't send anyone elsewhere. Anything else is the home page.
export function localPath(asked: string | undefined): string {
  const path = asked ?? "/";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/";
}
