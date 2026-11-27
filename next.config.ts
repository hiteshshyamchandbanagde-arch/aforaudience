import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Prod nit (27 Nov): Next's built-in trailing-slash redirect also hit
  // every client fetch("/api/...") (no slash) with a 308 hop. It is
  // switched off (docs: 03-file-conventions/proxy.md, "Advanced Proxy
  // flags") and redirects() below puts the same two rules back for
  // everything except /api/ and /_next/. Pages keep their canonical
  // slash URLs; /api/x and /api/x/ both answer without a redirect.
  skipTrailingSlashRedirect: true,
  async redirects() {
    // Copies of Next's internal rules (next/dist/lib/load-custom-routes.js)
    // with api/ and _next/ excluded. Checked live in
    // e2e/api-trailing-slash.spec.ts.
    const notApi = "(?!api(?:/|$)|_next/|\\.well-known(?:/.*)?)";
    return [
      {
        source: `/:file(${notApi}(?:[^/]+/)*[^/]+\\.\\w+)/`,
        destination: "/:file",
        permanent: true,
      },
      {
        // (?!/): user redirects (unlike Next's internal ones) also match
        // an optional trailing slash, so without it /events/ would 308 to
        // itself forever.
        source: `/:notfile(${notApi}(?:[^/]+/)*[^/\\.]+(?!/))`,
        destination: "/:notfile/",
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
  },
  // A stray package-lock.json one directory up (C:\Users\hites\AforA\)
  // was making Turbopack auto-detect that parent folder as the workspace
  // root instead of this project - broke every app route (404s across
  // the board) with no build error. Pin it explicitly.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
