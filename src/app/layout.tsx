import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { EVENT } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${EVENT.title} · Who's bringing what`,
  description: "Claim a dish so nobody doubles up.",
};

export const viewport: Viewport = {
  themeColor: "#f6eee2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
