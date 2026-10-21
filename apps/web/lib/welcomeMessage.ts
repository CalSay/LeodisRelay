/**
 * Words for the office to send someone who has not signed in yet: the link,
 * putting RELAY on the home screen, signing in, and finding their site.
 * Copy only: RELAY sends no email, so the office sends it by text, Teams or email.
 */
export function welcomeText(m: { name?: string | null; email: string; assignment: string }, origin: string): string {
  const first = (m.name ?? '').split(' ')[0];
  const engineer = m.assignment.startsWith('Engineer');
  return [
    `Hi${first ? ` ${first}` : ''},`,
    '',
    `You're set up on RELAY, the app we use for ${engineer ? 'site updates' : 'site reports'}.`,
    '',
    `1. On your phone, open this link in Safari (iPhone) or Chrome (Android): ${origin}/developments`,
    '2. Tap "Put RELAY on your home screen" and follow the steps. Then open RELAY from its new icon.',
    `3. Tap "Sign in with Microsoft" and use your work email, ${m.email}.`,
    engineer ? '4. If it asks, choose Developments and your site. Then tap "Start today\'s site update".' : '4. If it asks, choose Developments.',
    '',
    'Any problems, just ask me.',
  ].join('\n');
}
