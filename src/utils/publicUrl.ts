/**
 * Resolves a public or unbundled asset path against Vite's configured BASE_URL,
 * so assets load cleanly at both root (`/`) and GitHub Pages project subpaths
 * (e.g. `/frontiers-and-foundations/`).
 */
export function resolvePublicUrl(assetPath: string, baseUrl?: string): string {
  if (!assetPath) return assetPath;
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(assetPath)) {
    return assetPath;
  }

  const rawBase =
    baseUrl ??
    (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL
      ? (import.meta as unknown as { env?: { BASE_URL?: string } }).env!.BASE_URL!
      : '/');

  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  if (normalizedBase !== '/' && assetPath.startsWith(normalizedBase)) {
    return assetPath;
  }

  const trimmed = assetPath.replace(/^\/+/, '');
  return `${normalizedBase}${trimmed}`;
}

/**
 * Returns true when running in a static GitHub Pages build/host where
 * Express `/api/*` routes and `/ws/realm` WebSockets are unavailable.
 */
export function isStaticPagesHost(hostnameOverride?: string, envFlagOverride?: string): boolean {
  const envFlag =
    envFlagOverride ??
    (typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { VITE_STATIC_PAGES?: string } }).env?.VITE_STATIC_PAGES
      : undefined);

  if (envFlag === 'true') return true;

  const host =
    hostnameOverride ??
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '');

  return /\.github\.io$/i.test(host);
}
