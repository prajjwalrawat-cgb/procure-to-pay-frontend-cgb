/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace design system + shared packages from source.
  transpilePackages: ['@procureflow/ui', '@procureflow/shared'],
  experimental: {
    typedRoutes: false,
  },
  // Single-origin topology: the browser only ever talks to this web origin
  // (http://localhost:3000 in dev). Two families of rewrites make that work:
  //   - /api/v1/* is proxied to the real API so browser calls stay same-origin.
  //     API_INTERNAL_URL is the API's absolute base (…/api/v1); defaults to the
  //     local API dev server. NOTE: the web app's own route handlers live under
  //     /api/auth/*, so they never collide with the /api/v1/* rewrite.
  //   - /vendor/* is the vendor portal (its own Next app, basePath '/vendor')
  //     served under /vendor on this same origin. VENDOR_ZONE_URL is the vendor
  //     deployment's origin (defaults to its local dev server).
  async rewrites() {
    const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3001/api/v1';
    const vendor = process.env.VENDOR_ZONE_URL ?? 'http://localhost:3002';
    return [
      { source: '/api/v1/:path*', destination: `${api}/:path*` },
      { source: '/vendor', destination: `${vendor}/vendor` },
      { source: '/vendor/:path*', destination: `${vendor}/vendor/:path*` },
    ];
  },
};

export default nextConfig;
