import type { Metadata } from "next";
import { IBM_Plex_Mono, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import ThemeInit from "@/components/ThemeInit";

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
  title: "Limni Trading Intelligence",
  description: "Bias, sentiment, and signal intelligence for Limni.",
  icons: {
    icon: [
      { url: "/limni-icon.svg", type: "image/svg+xml" },
      { url: "/limni-icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: "/limni-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${libreBaskerville.variable} ${plexMono.variable} antialiased`}
      >
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
