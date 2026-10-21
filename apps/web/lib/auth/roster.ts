/** The app roles a person can be listed against on the checklist. */
export const ASSIGNMENTS = ['Admin','Manager','Engineer.Electrical','Engineer.HVAC','Engineer.PH'] as const;
export type Assignment = typeof ASSIGNMENTS[number];

/**
 * Assignment checklist only. Never used to authorize a login by email.
 * Admins can add, relist or remove people in Relay (lib/people.ts); this is the
 * starting list those changes are layered over.
 */
export const INITIAL_ROSTER: readonly { readonly email: string; readonly assignment: Assignment }[] = [
  {email:'callum@leodisme.com',assignment:'Admin'},
  ...['tom','ollie','jonny','russel'].map(name => ({email:`${name}@leodisme.com`,assignment:'Manager' as const})),
  ...['john','damien','graham.stephenson','bryony','tyler.parker'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.Electrical' as const})),
  ...['danny','anthony.dyson'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.HVAC' as const})),
  ...['chris','aidan','marcus','harvey.obrien','nicky.cunningham'].map(name => ({email:`${name}@leodisme.com`,assignment:'Engineer.PH' as const})),
];
