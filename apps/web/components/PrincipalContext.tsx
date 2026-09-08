'use client';
import { createContext, useContext } from 'react';
import type { Principal } from '@relay/platform';
const Context = createContext<Principal | null>(null);
export const usePrincipal = () => useContext(Context);
export function PrincipalContext({principal,children}: {principal:Principal|null;children:React.ReactNode}) {
  return <Context.Provider value={principal}>{children}</Context.Provider>;
}
