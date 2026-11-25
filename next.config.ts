import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
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
