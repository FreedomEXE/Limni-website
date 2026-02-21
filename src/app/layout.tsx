import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Limni Labs",
  description: "Bias, sentiment, and signal intelligence for Limni.",
  icons: {
    icon: [
      { url: "/limni-icon.svg", type: "image/svg+xml" },
      { url: "/limni-icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: "/limni-icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const stored = window.localStorage.getItem("limni-theme");
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sourceSans.variable} ${libreBaskerville.variable} ${plexMono.variable} antialiased`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
