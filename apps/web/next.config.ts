import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ss14help/calc", "@ss14help/schema"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
