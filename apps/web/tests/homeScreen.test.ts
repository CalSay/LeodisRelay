import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ICON_LAUNCH_COOKIE, hasIconLaunch, isIconLaunch } from '../lib/homeScreen';

test('only the address the home screen icon opens counts as a launch from the icon', () => {
  const manifest = readFileSync(resolve(__dirname, '../../app/manifest.ts'), 'utf8');
  const start = /start_url: "([^"]+)"/.exec(manifest)?.[1];
  assert.ok(start, 'manifest start_url');
  const url = new URL(start, 'https://app.relaybyleodis.com');
  assert.equal(isIconLaunch(url.pathname, url.searchParams), true);
  assert.equal(isIconLaunch('/', new URLSearchParams()), false);
  assert.equal(isIconLaunch('/developments', new URLSearchParams('open=app')), false);
  assert.equal(isIconLaunch('/', new URLSearchParams('open=other')), false);
});

test('the launch mark is found among other cookies, and not once cleared', () => {
  assert.equal(hasIconLaunch(`relay-theme=dark; ${ICON_LAUNCH_COOKIE}=1; relay-company=developments`), true);
  assert.equal(hasIconLaunch(`${ICON_LAUNCH_COOKIE}=1`), true);
  assert.equal(hasIconLaunch(`${ICON_LAUNCH_COOKIE}=`), false);
  assert.equal(hasIconLaunch(`x${ICON_LAUNCH_COOKIE}=1`), false);
  assert.equal(hasIconLaunch(''), false);
});

test('the installed app opens full screen within RELAY', () => {
  const manifest = readFileSync(resolve(__dirname, '../../app/manifest.ts'), 'utf8');
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /scope: "\/"/);
});
