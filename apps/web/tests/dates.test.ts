import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateShort, dayLong, dayShort, timeOf, whenShort } from '../lib/dates';

test('dates read the same way everywhere, with no locale commas or "Sept"', () => {
  assert.equal(dayShort('2026-09-16', true), 'Wed 16 Sep 2026');
  assert.equal(dayShort('2026-10-21', false), 'Wed 21 Oct');
  assert.equal(dayLong('2026-10-21'), 'Wednesday 21 October 2026');
  assert.equal(dayLong('2026-10-21', false), 'Wednesday 21 October');
  assert.equal(dateShort('2026-09-24'), '24 Sep 2026');
  assert.equal(dateShort('2026-09-24', false), '24 Sep');
});

test('times are UK time, and a calendar day is never shifted by a time zone', () => {
  // 23:30 UTC in summer time is 00:30 the next day in London.
  assert.equal(whenShort('2026-10-20T23:30:00Z', false), 'Wed 21 Oct, 00:30');
  assert.equal(timeOf('2026-10-20T23:30:00Z'), '00:30');
  // In winter London is on UTC.
  assert.equal(whenShort('2026-12-01T09:05:00Z', false), 'Tue 1 Dec, 09:05');
  assert.equal(dayShort('2026-03-29', false), 'Sun 29 Mar');
  assert.equal(whenShort('2026-03-29', false), 'Sun 29 Mar');
  assert.equal(timeOf('2026-03-29'), '');
});

test('the year shows only when it is not this year, unless asked', () => {
  const year = new Date().getUTCFullYear();
  assert.equal(dayShort(`${year - 1}-06-01`), `${dayShort(`${year - 1}-06-01`, false)} ${year - 1}`);
  assert.doesNotMatch(dayShort(`${year}-06-15`), /\d{4}$/);
});

test('missing or unreadable values give nothing to print', () => {
  for (const f of [dayShort, dayLong, dateShort, whenShort, timeOf]) {
    assert.equal(f(undefined), '');
    assert.equal(f(''), '');
    assert.equal(f('not a date'), '');
    assert.equal(f('2026-02-30'), '');
  }
});
