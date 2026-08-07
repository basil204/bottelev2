import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  // This repository contains multiple applications and lockfiles. Pinning the
  // app root keeps Turbopack dependency resolution inside this Next.js app.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
