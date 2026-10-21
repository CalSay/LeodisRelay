'use client';
import { createContext, useContext } from 'react';

/** The office's feature switches, read on the server for each page (lib/features.ts). */
export interface Features { safetyRecords: boolean }
const Context = createContext<Features>({ safetyRecords: false });
export const useFeatures = () => useContext(Context);
export function FeaturesContext({ features, children }: { features: Features; children: React.ReactNode }) {
  return <Context.Provider value={features}>{children}</Context.Provider>;
}
