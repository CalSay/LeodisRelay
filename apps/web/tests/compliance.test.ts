import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  AS, GR, TODAY, addDays, addMonths, assets, book, CATS, composeNotes, dayDiff, dueItems, ensureDraft, events, fileReport, groups, lateItems, noneItems,
  progress, remedials, rollup, sendForm, setAnswer, sign, status, visits,
} from '../lib/compliance/model';

test('sample model is internally consistent',() => {
  assert.ok(assets.length > 300 && groups.length > 100 && events.length > 200);
  for (const a of assets) assert.equal(GR[a.groupId]?.assetIds.includes(a.id),true,'every asset belongs to its group');
  const ids = new Set(events.map(e => e.id)); assert.equal(ids.size,events.length,'report references are unique');
  const r = rollup(groups); assert.equal(r.ok+r.soon+r.late+r.none,r.total);
  for (const v of visits) for (const gid of v.items) assert.ok(GR[gid],'visits only reference real groups');
});

test('status follows the requirement interval, and no record is its own state',() => {
  const fa = GR[AS['AVH-ARC-FA-01']!.groupId]!;
  const s = status(fa);
  assert.equal(s.key,'late'); assert.equal(s.days,-6,'the Aire Court panel is six days overdue');
  assert.equal(dayDiff(s.next!,addMonths(fa.last!,CATS.FA.months)),0);
  const none = noneItems()[0]!; assert.equal(status(none).key,'none'); assert.equal(status(none).next,null);
  assert.ok(lateItems().every(g => (status(g).days ?? 0) < 0));
  assert.ok(dueItems(30).every(g => { const d = status(g).days ?? 99; return d >= 0 && d <= 30; }));
});

test('booking never changes compliance; a filed report does',() => {
  const g = GR[AS['SCA-SCP-WH-01']!.groupId]!;
  assert.equal(status(g).key,'late');
  book(g,addDays(TODAY,2),'SK','Risk assessment');
  assert.equal(status(g).key,'late','a booking is a scheduling fact, not a legal one');
  const before = events.length;
  const {event,remedial} = fileReport(g,TODAY,'SK','pass','Reissued.');
  assert.equal(events.length,before+1); assert.equal(remedial,null); assert.equal(g.booking,null);
  assert.equal(status(g).key,'ok'); assert.equal(dayDiff(status(g).next!,addMonths(TODAY,CATS.WH.months)),0);
  assert.match(event.id,/^SCA-SCP-RA-\d{3}$/,'numbered in sequence per building and report type');
});

test('a service form is sent only when complete and signed, and a fail raises a remedial',() => {
  const g = GR[AS['NBE-WP3-GS-01']!.groupId]!;
  ensureDraft(g);
  assert.equal(progress(g).done,0);
  for (const f of ['ident','tight','flue','vent','safe','pipe']) setAnswer(g,f,f === 'tight' ? 'fail' : (f === 'ident' ? 'yes' : 'pass'));
  setAnswer(g,'pres','20.1'); setAnswer(g,'ratio','0.002'); setAnswer(g,'class','At Risk (AR)');
  const p = progress(g); assert.equal(p.done,p.total); assert.equal(p.signed,false);
  sign(g);
  const c = composeNotes(g,ensureDraft(g));
  assert.equal(c.fault,true); assert.match(c.notes,/Failed: Tightness test/); assert.match(c.notes,/At Risk/);
  const openBefore = remedials.filter(r => r.status === 'open').length;
  const out = sendForm(g,'JW',null);
  assert.equal(out.event.result,'fault'); assert.ok(out.remedial); assert.equal(out.remedial!.assetId,'NBE-WP3-GS-01');
  assert.equal(remedials.filter(r => r.status === 'open').length,openBefore+1);
  assert.equal(progress(g).done,0,'the draft is cleared once sent');
});
