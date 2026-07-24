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

/** Vendor portal issues vendor-audience JWTs (Master Context §3 rule #11). */
export const PORTAL = 'vendor' as const;
