import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProviderWrapper } from "@/components/providers/ThemeProviderWrapper";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://map.sbc.om"),
  title: "SBCMap | Enterprise Geospatial Platform",
  description:
    "High-precision interactive mapping platform for Oman and beyond. Real-time geospatial visualization, POI management, and enterprise-grade navigation tools.",
  keywords: ["mapping", "geospatial", "Oman", "interactive map", "POI", "satellite"],
  icons: {
    icon: [{ url: "/sbc.svg", type: "image/svg+xml" }],
    shortcut: "/sbc.svg",
    apple: "/sbc.svg",
  },
  openGraph: {
    title: "SBCMap | Enterprise Geospatial Platform",
    description:
      "High-precision interactive mapping platform for Oman and beyond.",
    type: "website",
    images: [{ url: "/sbc.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProviderWrapper>
          {children}
          <Toaster />
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
