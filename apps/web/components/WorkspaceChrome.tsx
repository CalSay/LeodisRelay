'use client';
import { usePathname } from 'next/navigation';
/**
 * Entry screens and the Compliance workspace own their header; the Developments
 * navigation stays exactly as it was everywhere else.
 */
export function WorkspaceChrome({children}: {children:React.ReactNode}) {
  const path=usePathname();
  if(path==='/' || path==='/signin' || path.startsWith('/signin/') || path==='/compliance' || path.startsWith('/compliance/')) return null;
  return <>{children}</>;
}
