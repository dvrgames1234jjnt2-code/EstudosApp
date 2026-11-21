import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "**.run.app",
    "**.googleusercontent.com",
    "**.google.com",
    "127.0.0.1",
    "localhost",
  ],
  transpilePackages: ["tldraw", "@tldraw/tldraw"],
};

export default nextConfig;
