/**
 * Browser-facing API base. Same-origin by default: the vendor portal is served
 * under /vendor on the web origin (http://localhost:3000 in dev), which rewrites
 * `/api/v1/*` to the real API. A root-absolute `/api/v1` base therefore reaches
 * the API through that single origin (basePath does not apply to root paths).
 */
export const API_URL = process.env.NEXT_PUBLIC_VENDOR_API_URL ?? '/api/v1';

/**
 * Server-only API base for the vendor route-handler proxies (login/refresh/
 * logout). These run in Node (the vendor process) and need an ABSOLUTE URL to
 * reach the API directly.
 */
export const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? 'http://localhost:3001/api/v1';

export const REFRESH_COOKIE = 'pf_vendor_refresh';

/**
 * URL base path this portal is served under. The vendor portal runs as a Next.js
 * multi-zone under `/vendor` (see next.config.mjs `basePath`), reached through the
 * web app's rewrite. Next auto-prefixes <Link>/router with basePath, but NOT raw
 * same-origin `fetch(...)`, so those calls must prepend BASE_PATH explicitly.
 * Keep this in sync with `basePath` in next.config.mjs.
 */
export const BASE_PATH = '/vendor';

/** Vendor portal issues vendor-audience JWTs (Master Context §3 rule #11). */
export const PORTAL = 'vendor' as const;
