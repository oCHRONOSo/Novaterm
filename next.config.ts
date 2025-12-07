import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker optimization
  output: 'standalone',
  
  // Allow external packages that need native bindings
  serverExternalPackages: ['ssh2'],
};

export default nextConfig;
