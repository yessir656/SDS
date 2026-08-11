import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline scripts for the runtime + inline styles for Tailwind/next-themes.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // connect-src allows fetch to same-origin API + WebSocket for dev HMR.
      "connect-src 'self'",
      // PDFs are viewed via blob: URLs from IndexedDB.
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // @napi-rs/canvas ships a pre-built native .node binary that Next.js's
  // turbopack bundler cannot resolve. Marking it as a server external package
  // tells Next.js to require it at runtime from node_modules instead of trying
  // to bundle it. Same for pdfjs-dist (large, uses dynamic imports).
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
