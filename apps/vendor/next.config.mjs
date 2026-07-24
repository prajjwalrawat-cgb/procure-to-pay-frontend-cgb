/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@procureflow/ui', '@procureflow/shared'],
  // Served as a Next.js multi-zone under /vendor, behind the web app's rewrite,
  // so buyer (/) and vendor (/vendor) share one origin/port. Keep in sync with
  // BASE_PATH in src/lib/env.ts.
  basePath: '/vendor',
  // The browser reaches this portal through the single web origin (:3000), whose
  // rewrite proxies /api/v1/* to the API. No API rewrite is needed here: with
  // basePath, a source of '/api/v1/*' would match '/vendor/api/v1/*', not the
  // root '/api/v1/*' the browser actually calls. Open the vendor portal via
  // /vendor on :3000, not the :3002 dev server directly.
};

export default nextConfig;
