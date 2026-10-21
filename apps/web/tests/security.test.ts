import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossSiteChange } from '../lib/crossSite';
import { SignInRefused, signInErrorMessage, signInErrorPath, SIGN_IN_ERRORS } from '../lib/auth/signInErrors';
import { accessFromRoles } from '../lib/auth/access';
import { signedCopyLink } from '../lib/variations';
import { TEXT_MAX, validateObservations } from '../lib/validatePhotos';

const request = (method: string, headers: Record<string, string>) => ({ method, headers: new Headers(headers) });

test('a change sent from another site, or another address on the same domain, is refused', () => {
  assert.equal(crossSiteChange(request('POST', { 'sec-fetch-site': 'cross-site' })), true);
  assert.equal(crossSiteChange(request('PUT', { 'sec-fetch-site': 'same-site' })), true);
  assert.equal(crossSiteChange(request('POST', { origin: 'https://evil.example', host: 'app.relaybyleodis.com' })), true);
  assert.equal(crossSiteChange(request('POST', { origin: 'null', host: 'app.relaybyleodis.com' })), true);
  // Behind Caddy the forwarded host is the address people used.
  assert.equal(crossSiteChange(request('POST', { origin: 'https://evil.example', host: 'web:4310', 'x-forwarded-host': 'app.relaybyleodis.com' })), true);
});

test("RELAY's own pages, reads and scripts without browser headers are let through", () => {
  assert.equal(crossSiteChange(request('POST', { 'sec-fetch-site': 'same-origin', origin: 'https://app.relaybyleodis.com' })), false);
  assert.equal(crossSiteChange(request('POST', { origin: 'https://app.relaybyleodis.com', host: 'app.relaybyleodis.com' })), false);
  assert.equal(crossSiteChange(request('POST', { origin: 'https://app.relaybyleodis.com', host: 'web:4310', 'x-forwarded-host': 'app.relaybyleodis.com' })), false);
  assert.equal(crossSiteChange(request('POST', { origin: 'http://192.168.1.20:4310', host: '192.168.1.20:4310' })), false);
  // Typed into the address bar or opened from the home screen.
  assert.equal(crossSiteChange(request('POST', { 'sec-fetch-site': 'none' })), false);
  assert.equal(crossSiteChange(request('POST', {})), false);
  // Reading is never a change: links from email and SharePoint still open RELAY.
  assert.equal(crossSiteChange(request('GET', { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })), false);
});

test('the sign-in screen says only its own words, whatever the address carries', () => {
  assert.equal(signInErrorMessage('role'), SIGN_IN_ERRORS.role);
  assert.equal(signInErrorMessage(undefined), null);
  // The old free-text form, or anything made up, reads as the general message.
  assert.equal(signInErrorMessage('Your account is locked. Ring 0113 000 0000 to unlock it.'), SIGN_IN_ERRORS.failed);
  assert.equal(signInErrorMessage('__proto__'), SIGN_IN_ERRORS.failed);
  // Microsoft's number is kept for an administrator, and only a number.
  assert.equal(signInErrorPath('microsoft', 'AADSTS50105: The signed in user is not assigned to a role'), '/signin?error=microsoft&ref=AADSTS50105');
  assert.equal(signInErrorPath('microsoft', 'Ring this number'), '/signin?error=microsoft');
  assert.match(signInErrorMessage('microsoft', 'AADSTS50105')!, /Microsoft reference AADSTS50105/);
  assert.equal(signInErrorMessage('microsoft', 'AADSTS50105 ring 0113'), SIGN_IN_ERRORS.microsoft);
});

test('a refusal at sign-in carries a code the screen can name', () => {
  assert.throws(() => accessFromRoles(['Admin', 'Manager']), (e: unknown) => e instanceof SignInRefused && e.code === 'role');
});

test('a signed copy opens only from an https address', () => {
  assert.equal(signedCopyLink({ signedInstruction: 'https://leodis.sharepoint.com/sites/Operations/VO-001.pdf' }), 'https://leodis.sharepoint.com/sites/Operations/VO-001.pdf');
  // SharePoint's "Copy path" gives spaces; RELAY accepts those when the office records them.
  assert.equal(signedCopyLink({ signedInstruction: 'https://leodis.sharepoint.com/sites/Ops/Shared Documents/VO-001.pdf' }), 'https://leodis.sharepoint.com/sites/Ops/Shared%20Documents/VO-001.pdf');
  for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>1</script>', 'http://example.com/a.pdf', '//evil.example', 'https://', '']) {
    assert.equal(signedCopyLink({ signedInstruction: bad }), undefined, bad);
  }
  assert.equal(signedCopyLink({}), undefined);
});

test('a card refuses a text box too long to have been typed on site', async () => {
  const card = (text: string) => [{ id: 'c1', type: 'update', location: 'Level 2', whatHappened: text, actionNeeded: '', owner: '', photos: [] }];
  assert.equal(await validateObservations(card('x'.repeat(TEXT_MAX)), 'rep-1', []), null);
  assert.match((await validateObservations(card('x'.repeat(TEXT_MAX + 1)), 'rep-1', []))!, /under 10,000 characters/);
});
