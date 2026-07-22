/** Normalize Next rewrite destination `/workspace` → public `/app` paths. */
export function toAppPath(pathname: string): string {
  if (pathname === "/workspace") return "/app";
  if (pathname.startsWith("/workspace/")) {
    return `/app${pathname.slice("/workspace".length)}`;
  }
  return pathname;
}
