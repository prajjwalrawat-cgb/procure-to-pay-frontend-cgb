/**
 * Browser-facing API base. Same-origin by default: the web server rewrites
 * `/api/v1/*` to the real API (see next.config.mjs), so the browser only ever
 * talks to the web origin (http://localhost:3000 in dev). A relative base keeps
 * this correct in every environment without hardcoding a host.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

/**
 * Server-only API base for the route-handler proxies (login/refresh/logout) and
 * the `/api/v1` rewrite target. These run in Node and need an ABSOLUTE URL to
 * reach the API directly (a relative path can't be fetched server-side).
 */
export const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? 'http://localhost:3001/api/v1';

/** httpOnly cookie name holding the refresh token (never exposed to JS). */
export const REFRESH_COOKIE = 'pf_refresh';

export const PORTAL = 'buyer' as const;
