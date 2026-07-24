/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace design system + shared packages from source.
  transpilePackages: ['@procureflow/ui', '@procureflow/shared'],
  experimental: {
    typedRoutes: false,
  },
  // Single-origin topology: the browser only ever talks to this web origin
  // (http://localhost:3000 in dev). Both the buyer (`/`) and vendor (`/vendor`)
  // portals are now served by this one app (route groups (web) and (vendor)),
  // so the only rewrite left is the API proxy: /api/v1/* is forwarded to the
  // real API so browser calls stay same-origin. API_INTERNAL_URL is the API's
  // absolute base (…/api/v1); defaults to the local API dev server. The app's
  // own route handlers live under /api/auth/* and /api/vendor/auth/*, so they
  // never collide with the /api/v1/* rewrite.
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3001/api/v1';
    return [{ source: '/api/v1/:path*', destination: `${api}/:path*` }];
  },
};

export default nextConfig;
