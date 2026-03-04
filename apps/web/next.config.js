let withSentryConfig = (config) => config;
try {
  // Optional dependency: only use if installed
  ({ withSentryConfig } = require("@sentry/nextjs"));
} catch {
  // Sentry not installed; keep config unchanged
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure a standalone build so the Dockerfile can COPY the standalone output
  // and include serverExternalPackages with native/binary deps so they are included
  // in the standalone bundle.
  serverExternalPackages: ["argon2", "pino", "pino-http", "puppeteer"],
  output: "standalone",
  // Empty turbopack config to silence webpack/turbopack warnings
  turbopack: {},
  // Remove X-Powered-By header (security best practice)
  poweredByHeader: false,
  // Enable instrumentation for startup validation
  // Note: instrumentationHook is now enabled by default in Next.js 16+
  experimental: {},
  // Compress responses (enabled by default in production)
  compress: true,
  // Generate ETags for better caching
  generateEtags: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Cache static assets aggressively
      {
        source: "/favicon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
});
