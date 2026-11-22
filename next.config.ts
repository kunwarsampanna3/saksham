import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy: no third-party scripts. Claude is only called from server routes.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://upload.wikimedia.org https://commons.wikimedia.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? " ws:" : ""}`,
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Face matching for KYC runs on the server with WebAssembly; keep these packages out of the bundle.
  serverExternalPackages: [
    "@vladmandic/face-api",
    "@tensorflow/tfjs",
    "@tensorflow/tfjs-core",
    "@tensorflow/tfjs-backend-wasm",
  ],
  // Lets the dev server be opened through GitHub Codespaces' forwarded address.
  allowedDevOrigins: ["*.app.github.dev"],
  // Middleware sees /api uploads too; its default 10 MB limit would cut off uploads the routes accept (20 MB).
  experimental: { middlewareClientMaxBodySize: "21mb" },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/wikipedia/commons/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self), publickey-credentials-get=(self)",
          },
          ...(isDev
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

/**
 * Edit mode (`next dev`) writes to `.next-dev`, the fast build (`next build` / `next start`) to `.next`.
 * Keeping them apart means running one never breaks the other.
 */
export default function config(phase: string): NextConfig {
  return { ...nextConfig, distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next" };
}
