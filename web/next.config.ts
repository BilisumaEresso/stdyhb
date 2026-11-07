import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  devIndicators: false,
  async rewrites() {
    // Determine the backend target URL:
    // 1. Explicit BACKEND_URL environment variable (from Vercel or .env.local)
    // 2. In production (if unset), default to the deployed backend: https://studyhubbot.onrender.com
    // 3. In local development (if unset), default to local server: http://localhost:5000
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://studyhubbot.onrender.com"
        : "http://localhost:5000");

    const backendUrl = rawBackendUrl.replace(/\/+$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
