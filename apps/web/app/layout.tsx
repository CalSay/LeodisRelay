import type { Metadata, Viewport } from "next";
import localFont from 'next/font/local';
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PwaRegistration } from "@/components/PwaRegistration";
import { currentPrincipal } from "@/lib/auth/session";
import { resolveProvider } from "@/lib/auth/provider";
import "./globals.css";
import './engineer.css';
import './entry.css';
import './search.css';
import './stages.css';
import { WorkspaceChrome } from '@/components/WorkspaceChrome';
import { canManage, isAdmin } from '@/lib/auth/access';
import { PrincipalContext } from '@/components/PrincipalContext';
import { InstallRelay } from '@/components/InstallRelay';
import { HeldWork } from '@/components/HeldWork';
import { DefectsOnSignal } from '@/components/DefectsOnSignal';
import { SignedOutPrompt } from '@/components/SignedOutPrompt';
import { IconOpensBrowser } from '@/components/IconOpensBrowser';
import { ProjectContext } from '@/components/ProjectContext';
import { refreshProjects, reportableProject, type ConnectedProject } from '@/lib/projects';
import { sharePointMode } from '@/lib/sharepoint/config';
import { safetyRecordsOn } from '@/lib/features';
import { FeaturesContext } from '@/components/FeaturesContext';

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
  // Each page names itself first, so a row of tabs or the phone's app switcher says which is which.
  title: { default: "RELAY", template: "%s · RELAY" },
  description: "Leodis site reporting",
  appleWebApp: { capable:true, title:'RELAY', statusBarStyle:'default' },
  // Next.js writes appleWebApp.capable as the newer "mobile-web-app-capable"
  // only. Older iPhones still look for Apple's own name before opening the
  // home screen icon full screen, without Safari's address bar.
  other: { 'apple-mobile-web-app-capable': 'yes' },
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
  let projects: ConnectedProject[] = [];
  let projectError: string | undefined;
  if (principal) {
    try { projects = (await refreshProjects()).filter(p => reportableProject(p)); }
    catch { projectError = 'SharePoint projects are unavailable. Please retry before starting a report.'; }
  }
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
        <div className="banner" role="region" aria-label="Test system">
          {sharePointMode() === 'off' ? 'PROTOTYPE — EXAMPLE DATA — NOT FOR REAL SITE WORK' : 'SHAREPOINT CONNECTION TEST — NOT FOR REAL SITE WORK'}
          {provider.kind === "local" ? " — IDENTITY NOT CHECKED" : ""}
        </div>

        <WorkspaceChrome><header className={`appbar${principal?.role==='Engineer'?' appbar-engineer':''}`}>
          <div className="appbar-inner">
            <Link href="/" className="brand">
              <span>RELAY</span>
              <em>LEODIS</em>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/developments">Home</Link>
              <Link href="/">Companies</Link>
              {principal && <Link href={principal.role==='Engineer'?'/engineer?view=projects':'/projects'}>Projects</Link>}
              {principal && canManage(principal) && <Link href="/engineer">Engineer view</Link>}
              {principal && canManage(principal) && <Link href="/office">Office</Link>}
              {principal && isAdmin(principal) && <Link href="/admin">Admin</Link>}
              {principal && <Link href="/help">Help</Link>}
            </nav>
            {/* Not navigation: kept beside the brand on a phone, so the links get a row of their own. */}
            <div className="appbar-tools">
              {principal && (
                <form action="/api/auth/signout" method="POST">
                  <button type="submit" className="whoami" title={principal.role==='Engineer'?'Sign out':`${principal.name}, ${principal.role}. Sign out`}>
                    Sign out
                  </button>
                </form>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <InstallRelay /></WorkspaceChrome>
        <SignedOutPrompt />
        <IconOpensBrowser />
        <FeaturesContext features={{ safetyRecords: safetyRecordsOn() }}><PrincipalContext principal={principal}><HeldWork /><DefectsOnSignal /><ProjectContext projects={projects} error={projectError}>{children}</ProjectContext></PrincipalContext></FeaturesContext>
      </body>
    </html>
  );
}
