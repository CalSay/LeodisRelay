import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay - capture prototype",
  description: "Leodis Relay site reporting capture prototype",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14171a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        {/*
          The banner is not decoration. This prototype saves to a fake server
          with no offline storage, and an engineer must never mistake it for
          the real thing while testing on their own phone.
        */}
        <div className="proto-banner">
          PROTOTYPE - example data, saves to a test server, not for real site work
        </div>
        {children}
      </body>
    </html>
  );
}
