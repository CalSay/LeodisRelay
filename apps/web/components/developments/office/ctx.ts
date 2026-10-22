import type { FixtureProject } from '@/lib/fixtures';
import type { OfficeTeam } from '@/lib/api';
import type { Dialog } from './Dialogs';
import type { ProjectStats, Snapshot } from './model';

export interface Route { tab: string; a: string | null; b: string | null; c: string | null; d?: string | null }

/** What every office screen is handed. Data, navigation, and the dialogs. */
export interface Ctx {
  snap: Snapshot | null;
  day: string;
  projects: FixtureProject[];
  stats: ProjectStats[];
  /** Any project in view uses review. Off by default, and then no review queue or count is shown. */
  reviewOn: boolean;
  statOf: (code: string) => ProjectStats | undefined;
  route: Route;
  go: (hash: string) => void;
  setDialog: (d: Dialog | null) => void;
  refresh: () => Promise<void>;
  me: { id: string; name: string; role: string; admin: boolean };
  team: OfficeTeam | null;
  /**
   * The name to show for a person. Looks up the name set in Relay by account id
   * and falls back to the name copied onto the record.
   */
  nameOf: (id: string | undefined, fallback: string) => string;
  loadTeam: () => void;
}
