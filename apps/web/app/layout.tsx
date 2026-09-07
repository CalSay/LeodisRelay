import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

/**
 * Archivo is a grotesque with an industrial, signage register — it sits
 * naturally with technical content without the neutrality of the usual UI
 * defaults. Plex Mono carries every reference, code and figure, so numbers
 * align down a column the way they do on a schedule.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relay",
  description: "Leodis site reporting",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1013",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {/*
          Not decoration. This prototype saves to a test server with no offline
          storage, and an engineer testing on their own phone must never mistake
          it for the real thing.
        */}
        <div className="banner">PROTOTYPE — EXAMPLE DATA — NOT FOR REAL SITE WORK</div>

        <header className="appbar">
          <div className="appbar-inner">
            <Link href="/" className="brand">
              <span>RELAY</span>
              <em>LEODIS</em>
            </Link>
            <nav className="nav">
              <Link href="/">Site</Link>
              <Link href="/office">Office</Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
