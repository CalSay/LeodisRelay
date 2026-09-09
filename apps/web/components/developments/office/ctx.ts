import type { FixtureProject } from '@/lib/fixtures';
import type { OfficeTeam } from '@/lib/api';
import type { Dialog } from './Dialogs';
import type { ProjectStats, Snapshot } from './model';

export interface Route { tab: string; a: string | null; b: string | null; c: string | null }

/** What every office screen is handed. Data, navigation, and the dialogs. */
export interface Ctx {
  snap: Snapshot | null;
  day: string;
  projects: FixtureProject[];
  stats: ProjectStats[];
  statOf: (code: string) => ProjectStats | undefined;
  route: Route;
  go: (hash: string) => void;
  setDialog: (d: Dialog | null) => void;
  refresh: () => Promise<void>;
  me: { id: string; name: string; role: string; admin: boolean };
  team: OfficeTeam | null;
  loadTeam: () => void;
}
