import { graph } from './graph';
import { OPERATIONS } from './config';
import { getRecord, records } from '../storage';

interface Person { id: string; name: string; email: string }
let cached: { until: number; people: Person[] } | undefined;
export async function sitePeople(): Promise<Person[]> {
  if (cached && cached.until > Date.now()) return cached.people;
  const lists = await graph.all<{ id: string; displayName: string }>(`/sites/${encodeURIComponent(OPERATIONS.site)}/lists?$select=id,displayName,system`);
  const users = lists.filter(l => l.displayName === 'User Information List');
  if (users.length !== 1) throw new Error('The SharePoint User Information List could not be resolved.');
  const rows = await graph.items(users[0]!.id);
  const people = rows.map(r => ({ id: r.id, name: String(r.fields.Title ?? ''), email: String(r.fields.EMail ?? '').toLowerCase() }));
  cached = { until: Date.now() + 60000, people };
  return people;
}
export async function personLookup(principalId: string | undefined): Promise<string> {
  if (principalId?.startsWith('sharepoint-user:')) {
    const id = principalId.slice('sharepoint-user:'.length);
    if ((await sitePeople()).some(p => p.id === id)) return id;
  }
  const identity = principalId ? getRecord<{ id: string; email: string }>('identities', principalId) : undefined;
  if (!identity?.email) throw new Error('A verified Microsoft identity is required for SharePoint attribution. Sign in again.');
  const matches = (await sitePeople()).filter(p => p.email && p.email === identity.email.toLowerCase());
  if (matches.length !== 1) throw new Error('The signed-in person is not uniquely resolvable on the SharePoint site. Site access must be provisioned first.');
  return matches[0]!.id;
}
export function principalForPerson(person: Person): string {
  const identities = records<{ id: string; email: string }>('identities').filter(p => p.email.toLowerCase() === person.email && !!person.email);
  return identities.length === 1 ? identities[0]!.id : `sharepoint-user:${person.id}`;
}
