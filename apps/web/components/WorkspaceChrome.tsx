'use client';
import { usePathname } from 'next/navigation';
/**
 * Entry screens and the two office workspaces own their header; the
 * Developments navigation stays exactly as it was everywhere else (the
 * engineer view, project pages, reports and issues).
 */
const OWN_CHROME = ['/', '/signin', '/compliance', '/office', '/admin'];
export function WorkspaceChrome({children}: {children:React.ReactNode}) {
  const path=usePathname();
  if(OWN_CHROME.some(p => path===p || (p!=='/' && path.startsWith(p+'/')))) return null;
  return <>{children}</>;
}
