import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcomeText } from '../lib/welcomeMessage';
import { rememberedCompany } from '../lib/company';
import { signInErrorMessage } from '../lib/auth/signInErrors';

test('the welcome message gives an engineer the link, their email and the four steps in order', () => {
  const text = welcomeText({ name: 'Sam Walker', email: 'sam@leodisme.com', assignment: 'Engineer.Electrical' }, 'https://relay.example');
  assert.match(text, /^Hi Sam,/);
  assert.ok(text.includes('https://relay.example/developments'));
  assert.ok(text.includes('sam@leodisme.com'));
  const steps = text.split('\n').filter(l => /^\d\. /.test(l)).map(l => l[0]);
  assert.deepEqual(steps, ['1', '2', '3', '4']);
  assert.ok(text.includes('Put RELAY on your home screen'));
  assert.ok(text.includes('Start today\'s site update'));
});

test('the welcome message works without a name, and an office person is not told to start a site update', () => {
  const text = welcomeText({ email: 'pm@leodisme.com', assignment: 'Manager' }, 'https://relay.example');
  assert.match(text, /^Hi,/);
  assert.ok(!text.includes('site update'));
});

test('only a known company is remembered for the home screen icon', () => {
  assert.equal(rememberedCompany('developments'), 'developments');
  assert.equal(rememberedCompany('compliance'), 'compliance');
  assert.equal(rememberedCompany('//evil.example'), null);
  assert.equal(rememberedCompany(undefined), null);
});

test('an account with no RELAY role is told to ask the office, in plain words', () => {
  const words = signInErrorMessage('role') ?? '';
  assert.ok(words.includes('Ask the office'));
  assert.ok(!/assign|exactly one/i.test(words));
});
