/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' bundles the minimal server + node_modules into .next/standalone/
  // so the Dockerfile runner stage can copy just that directory (no full node_modules).
  // Required for the production Docker image — do not remove.
  output: "standalone",

  // Required to enable src/instrumentation.ts (Next.js 14 opt-in)
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
