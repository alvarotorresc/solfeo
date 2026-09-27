function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Tells whether a navigation link points to the page being rendered. */
export function isCurrentPath(currentPathname: string, href: string): boolean {
  return stripTrailingSlash(currentPathname) === stripTrailingSlash(href);
}
