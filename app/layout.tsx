import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credit Quest",
  description: "Your next best move for better credit habits.",
  manifest: "/manifest.webmanifest",
  applicationName: "Credit Quest",
};

export const viewport: Viewport = {
  themeColor: "#6558f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
