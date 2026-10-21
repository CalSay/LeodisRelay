import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failure, failureMessage, passingFailure } from '../lib/failure';
import { ApiError } from '../lib/api';
import { notAdded, PhotoRefused } from '../lib/localMedia';
import { saveProblem, sendProblem } from '../lib/saveProblem';
import { GraphError } from '../lib/sharepoint/graph';
import { sharePointFailure } from '../lib/reportWorker';
import { overLimit, TEXT_MAX } from '../lib/textLimits';

// No status codes, proxy pages or developer words as the message.
const RAW = /\((?:4|5)\d\d\)|HTTP \d{3}|Bad Gateway|Microsoft Graph|TypeError|undefined/;

test('a proxy error page reads as the server not answering, with what to do and no code', () => {
  const said = failureMessage(502, undefined, 'The note could not be saved.', 'What you typed is still here.');
  assert.equal(said, 'The note could not be saved. RELAY’s server could not be reached just now. What you typed is still here. Try again in a minute. If it keeps happening, tell the office.');
  assert.doesNotMatch(said, RAW);
  assert.match(failureMessage(500, undefined, 'The list could not be loaded.'), /Something went wrong on RELAY’s server\. Try again in a minute/);
});

test('the server’s own words are kept when it gave them', () => {
  assert.equal(failureMessage(422, 'Keep the note to 4,000 characters.', 'The note could not be saved.', 'What you typed is still here.'), 'Keep the note to 4,000 characters. What you typed is still here.');
  assert.equal(failureMessage(503, 'SharePoint could not be reached. Please retry.', 'The issues could not be loaded.'), 'SharePoint could not be reached. Please retry.');
});

test('signed out says so and what to do, whatever the server said', () => {
  const said = failureMessage(401, 'Please sign in again.', 'The talk could not be saved.', 'What you typed is still here.');
  assert.equal(said, 'The talk could not be saved. You have been signed out. What you typed is still here. Sign in again, then try again.');
});

test('the cross-site refusal from the security review reads well, and is still a refusal', () => {
  const said = failureMessage(403, 'This change did not come from RELAY, so it was not made.', 'The chase could not be saved.', undefined, 'cross-site');
  assert.match(said, /^The chase could not be saved\. RELAY could not tell it came from its own page, so nothing was changed\. Reload the page/);
  // Any other refusal keeps the server's words.
  assert.equal(failureMessage(403, 'Manager access required.', 'That was not recorded.'), 'Manager access required.');
});

test('"No such issue." is the server talking to itself; a fuller reason is kept', () => {
  assert.equal(failureMessage(404, 'No such issue.', 'This issue could not be opened.'), 'This issue could not be opened. It could not be found. It may have been removed, or the link may be wrong.');
  assert.equal(failureMessage(404, 'No company or person by that name has issues on your projects.', 'x'), 'No company or person by that name has issues on your projects.');
});

test('signed out and the server at fault pass; a refusal, the cross-site one included, does not', () => {
  assert.equal(passingFailure(401), true);
  assert.equal(passingFailure(503), true);
  assert.equal(passingFailure(403, 'cross-site'), false, 'refused the same way every time, so not retried by itself');
  assert.equal(passingFailure(403), false);
  assert.equal(passingFailure(422), false);
  assert.equal(passingFailure(undefined), false);
  assert.equal(failure(429, {}, 'x').kind, 'server');
});

test('the report editor says where the work is for each kind of failed save', () => {
  const card = () => 'Level 2 corridor';
  const out = saveProblem(new ApiError('Please sign in again.', false, 401), true, card);
  assert.equal(out.state, 'signedout');
  assert.match(out.message, /^You have been signed out, so this is not saved to the server yet\. Your work is kept on this phone\. Sign in again and it saves by itself\.$/);
  const down = saveProblem(new ApiError('x', false, 502), true, card);
  assert.equal(down.state, 'server');
  assert.match(down.message, /RELAY’s server is not answering.*kept on this phone.*tries again by itself/);
  const photo = saveProblem(new PhotoRefused('p1', 'The file is not a supported photograph.'), true, card);
  assert.equal(photo.state, 'error');
  assert.equal(photo.message, 'A photograph on the card “Level 2 corridor” was not accepted: the file is not a supported photograph. Remove it and take it again. Your work is kept on this phone.');
  // Without a copy on the device it never says the work is kept.
  assert.match(saveProblem(new ApiError('x', false, 503), false, card).message, /would not keep a copy, so do not close this page/);
  assert.doesNotMatch(saveProblem(new ApiError('x', false, 503), false, card).message, /kept on this phone/);
  // The cross-site refusal is not retried by itself and is not called the server's fault.
  const crossSite = new ApiError(failureMessage(403, 'This change did not come from RELAY, so it was not made.', 'That did not go through.', undefined, 'cross-site'), false, 403, 'cross-site');
  const refusedHere = saveProblem(crossSite, true, card);
  assert.equal(refusedHere.state, 'error');
  assert.match(refusedHere.message, /could not tell it came from its own page.*Reload the page.*kept on this phone/);
  assert.equal(crossSite.refused, true);
  assert.match(sendProblem(new ApiError('x', false, 401), true, card), /signed out, so this has not been sent\. Your work is kept on this phone\. Sign in again, then send it\./);
  assert.match(sendProblem(new PhotoRefused('p1', ''), true, card), /was not accepted, so this has not been sent: the server would not take it/);
});

test('photographs not added are named with why, and the good ones counted', () => {
  assert.equal(notAdded(1, [{ name: 'drawing.gif', why: 'is not a JPEG, PNG or WebP photograph', advice: 'Take it with the camera.' }, { name: 'huge.jpg', why: 'is larger than 20 MB', advice: 'Take it again, or choose a smaller copy.' }]),
    '1 photograph added. drawing.gif is not a JPEG, PNG or WebP photograph and huge.jpg is larger than 20 MB, so they were not added. Take it with the camera. Take it again, or choose a smaller copy.');
  assert.equal(notAdded(0, [{ name: 'a.heic', why: 'is not a JPEG, PNG or WebP photograph', advice: 'Take it with the camera.' }]), 'a.heic is not a JPEG, PNG or WebP photograph, so it was not added. Take it with the camera.');
});

test('a box over the limit is caught on the card before the server refuses it', () => {
  const card = { location: 'L2', whatHappened: 'x'.repeat(TEXT_MAX), actionNeeded: '', owner: '' };
  assert.equal(overLimit(card), null);
  assert.equal(overLimit({ ...card, actionNeeded: 'y'.repeat(TEXT_MAX + 5) }), TEXT_MAX + 5);
});

test('SharePoint not answering: the report waits and says RELAY tries again; refused outright, it needs an Admin', () => {
  const busy = sharePointFailure(new GraphError(503), false);
  assert.equal(busy.status, 'pending');
  assert.match(busy.error, /^SharePoint was busy or not answering \(Microsoft answered 503\)\. RELAY tries again by itself\. The report is safe in RELAY\.$/);
  const unreachable = sharePointFailure(new TypeError('fetch failed'), false);
  assert.match(unreachable.error, /^SharePoint could not be reached\. RELAY tries again by itself/);
  assert.doesNotMatch(unreachable.error, /fetch failed/);
  const refused = sharePointFailure(new GraphError(403), true);
  assert.equal(refused.status, 'failed');
  assert.match(refused.error, /refused RELAY’s access\. An Admin needs to check the SharePoint connection.*An Admin can retry it/);
  assert.doesNotMatch(sharePointFailure(new Error('SQLITE_BUSY: database is locked'), true).error, /SQLITE/);
});
