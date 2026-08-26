import type { Metadata, Viewport } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/common/theme-provider";
import { ServiceWorkerRegister } from "@/components/common/service-worker-register";

// Flat design system: Outfit — geometric sans mirroring the UI's shapes.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SDS-CHEM — DOST-MIRDC Safety Data Sheet System",
  description:
    "Centralized Safety Data Sheet (SDS) management for chemical safety at the DOST-MIRDC. Works offline, no login required.",
  keywords: [
    "SDS",
    "Safety Data Sheet",
    "chemical safety",
    "GHS",
    "MIRDC",
    "DOST",
    "laboratory safety",
    "PWA",
  ],
  authors: [{ name: "DOST-MIRDC" }],
  manifest: "/manifest.json",
  icons: {
    // ?v=2 cache-buster: browsers cache favicons aggressively per URL — the
    // query string forces refetch after the icon set was regenerated.
    icon: [
      { url: "/icons/icon-16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg?v=2", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/icons/icon-32.png?v=2", type: "image/png" }],
    apple: [
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SDS-CHEM",
  },
  applicationName: "SDS-CHEM",
  openGraph: {
    title: "SDS-CHEM — DOST-MIRDC Safety Data Sheet System",
    description:
      "Centralized SDS management for chemical safety at DOST-MIRDC. Offline-first PWA.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a2540",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
        <body
          className={`${outfit.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
        >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
