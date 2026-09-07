import type { Metadata, Viewport } from "next";
import localFont from 'next/font/local';
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PwaRegistration } from "@/components/PwaRegistration";
import { currentPrincipal } from "@/lib/auth/session";
import { resolveProvider } from "@/lib/auth/provider";
import "./globals.css";

/**
 * Archivo is a grotesque with an industrial, signage register — it sits
 * naturally with technical content without the neutrality of the usual UI
 * defaults. Plex Mono carries every reference, code and figure, so numbers
 * align down a column the way they do on a schedule.
 */
const archivo = localFont({
  src: [
    { path:'../../../packages/documents/fonts/Archivo-Regular.ttf',weight:'400' },
    { path:'../../../packages/documents/fonts/Archivo-Medium.ttf',weight:'500' },
    { path:'../../../packages/documents/fonts/Archivo-SemiBold.ttf',weight:'600' },
  ],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path:'../../../packages/documents/fonts/IBMPlexMono-Regular.ttf',weight:'400' },
    { path:'../../../packages/documents/fonts/IBMPlexMono-Medium.ttf',weight:'500' },
  ],
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
  // The phone's browser chrome follows the theme too, so the app does not sit
  // in a bar of the opposite colour.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1013" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const principal = await currentPrincipal();
  const { provider } = resolveProvider();
  return (
    <html lang="en-GB" className={`${archivo.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Applied before first paint, so a stored preference never shows a
          flash of the other theme. It is small and synchronous on purpose:
          anything deferred is a flash by definition.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("relay-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <PwaRegistration />
        {/*
          Not decoration. This prototype saves to a test server with no offline
          storage, and an engineer testing on their own phone must never mistake
          it for the real thing.
        */}
        <div className="banner">
          PROTOTYPE — EXAMPLE DATA — NOT FOR REAL SITE WORK
          {provider.kind === "local" ? " — IDENTITY NOT CHECKED" : ""}
        </div>

        <header className="appbar">
          <div className="appbar-inner">
            <Link href="/" className="brand">
              <span>RELAY</span>
              <em>LEODIS</em>
            </Link>
            <nav className="nav">
              <Link href="/">Site</Link>
              <Link href="/office">Office</Link>
              {principal && (
                <form action="/api/auth/signout" method="POST" style={{ display: "inline" }}>
                  <button type="submit" className="whoami" title="Sign out">
                    {principal.name}
                  </button>
                </form>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
