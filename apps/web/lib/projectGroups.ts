export const ACTIVE_PROJECT_STATUS = '4. Active';
export const DLP_PROJECT_STATUS = '5. Defects Liability';

export interface ProjectStatusGroup<T> {
  status: typeof ACTIVE_PROJECT_STATUS | typeof DLP_PROJECT_STATUS;
  label: string;
  projects: T[];
}

/** Restore the positions captured from SharePoint after records leave SQLite. */
export function sharePointOrdered<T extends { sharePointOrder?: number }>(projects: T[]): T[] {
  return projects.map((project, cacheOrder) => ({ project, cacheOrder })).sort((a, b) => {
    const left = a.project.sharePointOrder ?? Number.MAX_SAFE_INTEGER;
    const right = b.project.sharePointOrder ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.cacheOrder - b.cacheOrder;
  }).map(({ project }) => project);
}

/** Group reportable projects without disturbing their SharePoint list order. */
export function projectStatusGroups<T extends { status: string }>(projects: T[]): ProjectStatusGroup<T>[] {
  return [
    {
      status: ACTIVE_PROJECT_STATUS,
      label: 'Active',
      projects: projects.filter(project => project.status === ACTIVE_PROJECT_STATUS),
    },
    {
      status: DLP_PROJECT_STATUS,
      label: 'Defects liability period',
      projects: projects.filter(project => project.status === DLP_PROJECT_STATUS),
    },
  ];
}
