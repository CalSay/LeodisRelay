'use client';
import { createContext, useContext } from 'react';
import type { ConnectedProject } from '@/lib/projects';
const Context = createContext<ConnectedProject[]>([]);
export const useProjects = () => useContext(Context);
export function useProjectLookup() {
  const projects = useProjects();
  return (id: string) => projects.find(p => p.id === id);
}
export function ProjectContext({ projects, error, children }: { projects: ConnectedProject[]; error?: string; children: React.ReactNode }) {
  return <Context.Provider value={projects}>{error && <p role="alert" className="wrap">{error}</p>}{children}</Context.Provider>;
}
