import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFields, isEmptySiteInfo, mapsHref, nextSiteInfo, readSiteInfoInput, telHref, EMPTY_SITE_INFO, type SiteInfoFields } from '../lib/siteInfo';
import { getSiteInfo, saveSiteInfo } from '../lib/siteInfoStore';

process.env.RELAY_DATA_ROOT = mkdtempSync(join(tmpdir(), 'relay-site-info-test-'));

const filled: SiteInfoFields = {
  address: 'Tetley Hall, Block E\nKirkstall Road\nLeeds LS4 2AB',
  hours: 'Monday to Friday 7.30am to 5pm',
  access: 'Park on Kirkstall Road. Sign in at the welfare cabin by gate 2.',
  safety: 'Site induction on first visit. Hard hat, boots, hi-vis and gloves.',
  contacts: [{ name: 'Jo Bloggs', role: 'Site manager', phone: '07700 900123' }],
};

test('tidies what the office typed and drops empty contact rows', () => {
  const read = readSiteInfoInput({ address: '  Tetley Hall\r\nLeeds  \r\n', hours: 'Mon–Fri\u0007', access: undefined, contacts: [
    { name: ' Jo Bloggs ', role: 'Site\nmanager', phone: ' 07700  900123 ' },
    { name: '', role: '', phone: '' },
  ] });
  assert.deepEqual(read, { ok: true, value: { address: 'Tetley Hall\nLeeds', hours: 'Mon–Fri', access: '', safety: '', contacts: [{ name: 'Jo Bloggs', role: 'Site manager', phone: '07700 900123' }] } });
  assert.deepEqual(readSiteInfoInput({}), { ok: true, value: EMPTY_SITE_INFO }, 'every field may be left blank');
});

test('refuses a contact without a name or number, a number that is not one, and text that is too long', () => {
  const reason = (body: unknown) => { const r = readSiteInfoInput(body); return r.ok ? '' : r.reason; };
  assert.match(reason({ contacts: [{ name: '', role: 'Security', phone: '0113 496 0000' }] }), /needs a name/);
  assert.match(reason({ contacts: [{ name: 'Jo', role: '', phone: '' }] }), /phone number for Jo/);
  assert.match(reason({ contacts: [{ name: 'Jo', role: '', phone: 'ring the gate' }] }), /does not look like a phone number/);
  assert.match(reason({ contacts: [{ name: 'Jo', role: '', phone: '123' }] }), /does not look like a phone number/);
  assert.match(reason({ address: 'x'.repeat(301) }), /Address is too long/);
  assert.match(reason({ hours: 7 }), /must be text/);
  assert.match(reason({ contacts: 'Jo' }), /must be a list/);
  assert.match(reason({ contacts: Array.from({ length: 9 }, (_, n) => ({ name: `P${n}`, role: '', phone: '0113 496 0000' })) }), /8 contacts or fewer/);
  assert.match(reason(null), /Nothing to save/);
  assert.equal(reason({ contacts: [{ name: 'Gate', role: '', phone: '+44 (0)113 496-0000' }] }), '');
});

test('dial and map links', () => {
  assert.equal(telHref('07700 900123'), 'tel:07700900123');
  assert.equal(telHref('+44 (0)113 496-0000'), 'tel:+4401134960000');
  assert.equal(mapsHref('Tetley Hall\n Leeds LS4 2AB'), 'https://www.google.com/maps/search/?api=1&query=Tetley%20Hall%2C%20Leeds%20LS4%202AB');
});

test('a save records who changed what, newest first, and keeps the history short', () => {
  const first = nextSiteInfo(undefined, 'p1', filled, { name: 'A. Whitfield', id: 'entra:aw' }, '2026-10-20T09:00:00.000Z');
  assert.equal(first.version, 1);
  assert.deepEqual(first.history, [{ at: '2026-10-20T09:00:00.000Z', by: 'A. Whitfield', fields: ['address', 'hours', 'access', 'safety', 'contacts'] }]);
  const second = nextSiteInfo(first, 'p1', { ...filled, hours: 'Monday to Saturday' }, { name: 'B. Office' }, '2026-10-21T09:00:00.000Z');
  assert.equal(second.version, 2);
  assert.equal(second.updatedBy, 'B. Office');
  assert.equal(second.updatedById, undefined);
  assert.deepEqual(second.history.map(h => h.fields), [['hours'], ['address', 'hours', 'access', 'safety', 'contacts']]);
  let many = second;
  for (let n = 0; n < 12; n++) many = nextSiteInfo(many, 'p1', { ...filled, hours: `h${n}` }, { name: 'X' }, `2026-11-${String(n + 1).padStart(2, '0')}T09:00:00.000Z`);
  assert.equal(many.history.length, 10);
  assert.equal(many.history[0]!.at, '2026-11-12T09:00:00.000Z');
  assert.deepEqual(changedFields(filled, { ...filled, contacts: [{ ...filled.contacts[0]!, phone: '0113 496 0000' }] }), ['contacts']);
  assert.equal(isEmptySiteInfo(EMPTY_SITE_INFO), true);
  assert.equal(isEmptySiteInfo({ ...EMPTY_SITE_INFO, contacts: filled.contacts }), false);
});

test('the store refuses a save made from an older copy and leaves an unchanged save alone', () => {
  assert.equal(getSiteInfo('proj-store'), undefined);
  assert.deepEqual(saveSiteInfo('proj-store', EMPTY_SITE_INFO, 0, { name: 'A' }), { ok: true, value: undefined }, 'saving nothing creates nothing');
  assert.equal(getSiteInfo('proj-store'), undefined);
  const made = saveSiteInfo('proj-store', filled, 0, { name: 'A. Whitfield' }, '2026-10-20T09:00:00.000Z');
  assert.ok(made.ok && made.value?.version === 1);
  const stale = saveSiteInfo('proj-store', { ...filled, hours: 'Weekends' }, 0, { name: 'B. Office' });
  assert.ok(!stale.ok);
  assert.equal(stale.status, 409);
  assert.equal(stale.current?.updatedBy, 'A. Whitfield', 'the refusal carries what the other person saved');
  const same = saveSiteInfo('proj-store', filled, 1, { name: 'B. Office' }, '2026-10-22T09:00:00.000Z');
  assert.ok(same.ok);
  assert.equal(same.value?.version, 1, 'no new version for no change');
  assert.equal(getSiteInfo('proj-store')?.updatedBy, 'A. Whitfield');
  const next = saveSiteInfo('proj-store', { ...filled, hours: 'Weekends' }, 1, { name: 'B. Office' }, '2026-10-22T09:00:00.000Z');
  assert.ok(next.ok);
  assert.equal(getSiteInfo('proj-store')?.version, 2);
  assert.equal(getSiteInfo('proj-store')?.hours, 'Weekends');
  assert.equal(getSiteInfo('other'), undefined, 'one record per project');
});
