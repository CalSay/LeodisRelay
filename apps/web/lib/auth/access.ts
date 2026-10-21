import type { Principal } from '@relay/platform';
import { SignInRefused } from './signInErrors';

export const APP_ROLES = {
  Admin: { role: 'Admin' },
  Manager: { role: 'Manager' },
  'Engineer.Electrical': { role: 'Engineer', trade: 'Electrical' },
  'Engineer.HVAC': { role: 'Engineer', trade: 'HVAC' },
  'Engineer.PH': { role: 'Engineer', trade: 'P&H' },
} as const;

/** Exactly one explicit app assignment; email/display name never grants access. */
export function accessFromRoles(roles: unknown): Pick<Principal, 'role' | 'trade'> {
  if (!Array.isArray(roles) || roles.length !== 1 || typeof roles[0] !== 'string' ||
      !Object.prototype.hasOwnProperty.call(APP_ROLES, roles[0])) {
    throw new SignInRefused('role');
  }
  return APP_ROLES[roles[0] as keyof typeof APP_ROLES];
}
export function hasRole(p: Principal): boolean {
  return p.role === 'Admin' || p.role === 'Manager' || p.role === 'Engineer';
}
export function canManage(p: Principal): boolean { return p.role === 'Admin' || p.role === 'Manager'; }
export function isAdmin(p: Principal): boolean { return p.role === 'Admin'; }
/** All projects for all three roles in the pilot. Assignment scope can narrow later. */
export function canAccessProject(p: Principal, projectId: string): boolean { return hasRole(p) && projectId.length > 0; }
export function ownsReport(p: Principal, r: { authorId?: string }): boolean { return r.authorId === p.id; }
export function canReadReport(p: Principal, r: { projectId: string; state: string; authorId?: string }): boolean {
  return canAccessProject(p,r.projectId) && (r.state === 'submitted' || ownsReport(p,r));
}
export function canIssueCommand(p: Principal, kind: string): boolean {
  if (!hasRole(p)) return false;
  if (kind === 'progress' || kind === 'submit_closure') return true;
  return canManage(p) && ['assign','verify','reopen','confirm','withdraw','note'].includes(kind);
}
/** Anyone on the project can add a note to a variation; pricing, instructing, declining, calling it within contract and reopening are office acts. */
/** Office corrections to a sent report (within contract, already raised, notes) are Manager/Admin acts. */
export function canCorrectReport(p: Principal): boolean { return canManage(p); }
export function canVariationCommand(p: Principal, kind: string): boolean {
  if (!hasRole(p)) return false;
  if (kind === 'note') return true;
  return canManage(p) && ['details','price','instruct','decline','within_contract','reopen'].includes(kind);
}
