/** Prefix manifest paths (e.g. `/audio/...`) with Vite `base` for GitHub Pages project sites. */
export function resolvePublicUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL;
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${relative}`;
}
