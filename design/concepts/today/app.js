// Concept A, "Today". Renders every screen from ../data.js (the busy-projects seed).
(() => {
const D = window.RELAY_DATA;
const TODAY = D.today;
const SITE = 'proj-011lme';
const ME = D.people.engineer;

// ── Helpers ────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = iso => String(iso || '').slice(0, 10);
const asDate = ymd => new Date(`${ymd}T12:00:00Z`);
const addDays = (ymd, n) => { const d = asDate(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((asDate(b) - asDate(a)) / 86400000);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDay = ymd => { const d = asDate(ymd); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const fmtShort = ymd => { const d = asDate(ymd); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const fmtLong = ymd => { const d = asDate(ymd); return `${DOWL[d.getUTCDay()]} ${d.getUTCDate()} ${MONL[d.getUTCMonth()]}`; };
const time = iso => String(iso || '').slice(11, 16);
const relDay = ymd => { const n = daysBetween(ymd, TODAY); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : fmtDay(ymd); };
const ago = ymd => { const n = daysBetween(ymd, TODAY); return n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`; };
const money = n => '£' + Math.round(n).toLocaleString('en-GB');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const proj = id => D.projects.find(p => p.id === id);
const short = ref => String(ref).replace(/^\d+[A-Z]+-/, '');

const ICON = {
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  pound: '<path d="M16 6.5A4 4 0 0 0 9 9v8M6 13h7M6 18h11"/>',
  doc: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  fixed: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-4.9"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
};
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const photo = (w, h, n) => `<div class="ph" style="width:${w}px;height:${h}px">${icon('camera', '')}${n ? `<em>${n}</em>` : ''}</div>`;

const KIND = { update: 'Progress', defect: 'Defect', access: 'Access problem', variation: 'Variation' };
const open = i => i.work !== 'closed';
const overdue = i => open(i) && i.target && i.target < TODAY;
function issueState(i) {
  if (i.sentBack) return ['amber', 'Sent back to you'];
  if (i.work === 'closed') return ['green', 'Closed'];
  if (i.work === 'awaiting_verification') return ['blue', 'Fixed, to check'];
  if (overdue(i)) return ['red', `${daysBetween(i.target, TODAY)} days late`];
  if (i.work === 'open') return ['amber', 'Needs an owner'];
  if (i.work === 'in_progress') return ['', 'Being fixed'];
  return ['', 'With the trade'];
}
const stateTag = i => { const [c, w] = issueState(i); return `<span class="st ${c}">${w}</span>`; };
const EVENT = { raised: 'Raised', confirmation: 'Confirmed by the office', assigned: 'Passed to the trade', progress: 'Update from site', closure_submitted: 'Put forward as fixed', verified: 'Checked and closed', reopened: 'Sent back' };
const noteOf = e => e.note && e.note !== (EVENT[e.kind] || '') && e.note !== 'Passed to the trade' ? e.note : '';
const lastEvent = (i, kind) => [...i.events].reverse().find(e => e.kind === kind);

// ── Engineer phone ──────────────────────────────────────────────────────
function tabbar(on) {
  const t = [['today', 'Today', 'sun', '#eng-home'], ['issues', 'Issues', 'list', '#eng-issue'], ['reports', 'Reports', 'file', '#eng-update'], ['more', 'More', 'more', '#eng-home']];
  return `<div class="tabbar"><nav>${t.map(([k, l, ic, h]) => `<a class="${k === on ? 'on' : ''}" href="${h}"><span class="${k === 'issues' ? 'pip' : ''}">${icon(ic)}</span>${l}</a>`).join('')}</nav></div>`;
}
function phoneTop() {
  return `<div class="p-top"><span class="wordmark">RELAY</span><button class="site-chip">${esc(proj(SITE).name)} ${icon('down')}</button></div>`;
}

function engHome() {
  const p = proj(SITE);
  const mine = D.issues.filter(i => i.projectId === SITE);
  const back = mine.filter(i => i.sentBack);
  const waiting = mine.filter(i => i.raisedBy === ME.name && i.work === 'awaiting_verification');
  const openHere = mine.filter(open), late = openHere.filter(overdue), myTrade = openHere.filter(i => i.trade === ME.trade);
  const cards = D.draft.cards;
  const photos = cards.reduce((a, c) => a + c.photos, 0);
  const need = i => {
    const e = lastEvent(i, 'reopened');
    return `<div class="card need">
      <div class="said"><small>${esc(e.who)} · ${relDay(day(e.at)).toLowerCase()} at ${time(e.at)}</small><p>“${esc(e.note)}”</p></div>
      <div class="need-what"><b class="clamp2">${esc(i.text)}</b><span>${esc(i.location)} · ${short(i.ref)} · you raised it ${fmtShort(day(i.raisedAt))}</span></div>
      <a class="btn main" href="#eng-issue">${icon('camera')} Answer with a photo</a>
    </div>`;
  };
  return `<div class="phone">${phoneTop()}
        <h1 class="p-h1">Today at ${esc(p.name.replace(/ - .*/, ''))}</h1>
    <p class="p-sub">${fmtDay(TODAY)} · Good afternoon, ${esc(ME.name.split(' ')[0])} · ${esc(p.name.replace(/.* - /, ''))}</p>
    <a class="go" href="#eng-update"><div><b>Carry on today’s update</b><small>${plural(cards.length, 'card')} · ${plural(photos, 'photo')} · saved 13:32</small><div class="dots">${cards.map(() => '<i></i>').join('')}<i class="off"></i></div></div><span class="arrow">${icon('arrow')}</span></a>
    <section class="p-sec"><div class="p-sec-h"><h2>Needs you${back.length ? `<span class="count">${back.length}</span>` : ''}</h2><span>from the office</span></div>
      ${back.length ? back.map(need).join('') : '<div class="card waiting"><span>Nothing from the office. You’re all caught up.</span></div>'}
      ${waiting.length ? `<a class="card waiting" href="#eng-issue"><span>${plural(waiting.length, 'fix', 'fixes')} you put forward, waiting for the office to check</span>${icon('chev')}</a>` : ''}
    </section>
    <section class="p-sec"><div class="p-sec-h"><h2>Send straight away</h2></div>
      <div class="quick">
        <button><span class="ic red">${icon('alert')}</span><span><b>Defect</b><small>Photo and note</small></span></button>
        <button><span class="ic amber">${icon('pound')}</span><span><b>Variation</b><small>Extra work</small></span></button>
      </div>
    </section>
    <section class="p-sec"><div class="p-sec-h"><h2>Around you</h2></div>
      <a class="card around" href="#eng-issue"><span class="big">${openHere.length}</span><div><b>open issues on this site</b><span>${myTrade.length} in Electrical · <span class="late">${late.length} past their date</span></span></div>${icon('chev')}</a>
    </section>
  </div>${tabbar('today')}`;
}

function engUpdate() {
  const p = proj(SITE), cards = D.draft.cards, first = cards[0];
  const rows = cards.slice(1).map((c, n) => `<div class="ed-row"><span class="n">${icon('check')}</span><div><b>${KIND[c.type]} · ${esc(c.location)}</b><span class="clamp1">${esc(c.text)}</span></div><span class="muted">${plural(c.photos, 'photo')}</span></div>`).join('');
  return `<div class="phone">
    <div class="ed-top"><button class="icon-btn" aria-label="Back to Today">${icon('back')}</button><div class="t"><b>Today’s site update</b><span>${esc(p.name)} · ${fmtDay(TODAY)}</span></div><span class="saved">Saved</span></div>
    <div class="steps"><div class="on">Cards · ${cards.length}</div><div>Check</div><div>Send</div></div>
    <div class="card ed-card">
      <div class="ed-card-h"><b>Card 1 of ${cards.length}</b><button class="btn quiet sm">Remove</button></div>
      <div class="seg" role="group" aria-label="What is this card?">${['update', 'defect', 'access', 'variation'].map(k => `<button class="${k === first.type ? 'on' : ''}">${k === 'access' ? 'Access' : KIND[k]}</button>`).join('')}</div>
      <div class="shots">${Array.from({ length: first.photos }, () => photo(74, 74)).join('')}<button class="take">${icon('camera')}Add photo</button></div>
      <div class="fld"><label>Where on site?</label><div class="in">${esc(first.location)}</div><div class="chips"><span class="on">${esc(first.location)}</span><span>Switch room</span><span>Podium deck</span><span>Level 4 corridor</span></div></div>
      <div class="fld"><label>What did you find?</label><div class="in tall">${esc(first.text)}</div></div>
      <div class="fld"><label>Who needs to sort it?</label><div class="in">${esc(first.owner)}</div></div>
      <div class="fld" style="margin-bottom:0"><label>Trade affected</label><div class="chips">${['Electrical', 'HVAC', 'P&H', 'Other'].map(t => `<span class="${t === first.trade ? 'on' : ''}">${esc(t)}</span>`).join('')}</div></div>
    </div>
    <div class="card" style="margin-top:12px">${rows}</div>
    <div class="add-row"><button>+ Progress</button><button>+ Defect</button><button>+ More</button></div>
  </div>
  <div class="sendbar"><div><button>Check and send ${plural(cards.length, 'card')} ${icon('arrow')}</button></div></div>`;
}

function engIssue() {
  const i = D.issues.find(x => x.sentBack) || D.issues.find(x => x.projectId === SITE && open(x));
  const e = lastEvent(i, 'reopened');
  const late = overdue(i);
  const hist = [...i.events].reverse().slice(0, 4);
  return `<div class="phone">
    <div class="ed-top"><a class="icon-btn" href="#eng-home" aria-label="Back">${icon('back')}</a><div class="t"><b>Issue</b><span class="ref">${esc(i.ref)}</span></div>${stateTag(i)}</div>
    ${e ? `<div class="said" style="margin-top:8px"><small>${esc(e.who)} sent this back · ${relDay(day(e.at)).toLowerCase()} at ${time(e.at)}</small><p>“${esc(e.note)}”</p></div>` : ''}
    <h1 class="iss-h1">${esc(i.text)}</h1>
    <dl class="card facts">
      <div><dt>Where</dt><dd>${esc(i.location)}</dd></div>
      <div><dt>What to do</dt><dd>${esc(i.action)}</dd></div>
      <div><dt>Who</dt><dd>${esc(i.owner || 'Not given yet')}</dd></div>
      <div><dt>By when</dt><dd>${i.target ? fmtDay(i.target) : 'No date'}${late ? ` · <span class="late">${daysBetween(i.target, TODAY)} days late</span>` : ''}</dd></div>
    </dl>
    <button class="big-main">${icon('camera')} Add photo and mark as fixed</button>
    <button class="big-quiet">Add an update without fixing</button>
    <section class="p-sec"><div class="p-sec-h"><h2>What’s happened</h2><span>${plural(i.events.length, 'update')}</span></div>
      <div class="card tl"><ul>${hist.map((h, n) => `<li class="${n === 0 ? 'hot' : ''}"><div><b>${EVENT[h.kind] || h.kind}</b>${noteOf(h) ? ` · “${esc(noteOf(h))}”` : ''}<span>${esc(h.who)} · ${fmtDay(day(h.at))}</span></div></li>`).join('')}</ul></div>
    </section>
  </div>${tabbar('issues')}`;
}

// ── Office desk ─────────────────────────────────────────────────────────
const fresh = D.reports.filter(r => !r.seen && r.date >= addDays(TODAY, -14));
const toCheck = D.issues.filter(i => i.work === 'awaiting_verification').sort((a, b) => lastEvent(a, 'closure_submitted').at.localeCompare(lastEvent(b, 'closure_submitted').at));
const unassigned = D.issues.filter(i => i.work === 'open').sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
const varsWaiting = D.variations.filter(v => v.instruction === 'pending').sort((a, b) => Number(b.workDone) - Number(a.workDone) || a.raisedAt.localeCompare(b.raisedAt));
const openAll = D.issues.filter(open);

function deskTop(on) {
  const t = [['today', 'Today', '#office-home', fresh.length + toCheck.length + unassigned.length + varsWaiting.length], ['issues', 'Issues', '#office-issues', openAll.length], ['reports', 'Reports', '#office-report', 0], ['week', 'Week in review', '#office-weekly', 0], ['projects', 'Projects', '#office-home', 0]];
  return `<header class="d-top"><span class="wordmark">RELAY</span><nav>${t.map(([k, l, h, n]) => `<a class="${k === on ? 'on' : ''}" href="${h}">${l}${n ? `<i>${n}</i>` : ''}</a>`).join('')}</nav>
    <div class="search">${icon('search')}Search reports, issues, places, people<kbd>/</kbd></div>
    <div class="me"><span class="avatar">OM</span></div></header>`;
}

function projectStrip() {
  return `<div class="strip">${D.projects.map(p => {
    const last = D.reports.filter(r => r.projectId === p.id).map(r => r.date).sort().at(-1);
    const iss = openAll.filter(i => i.projectId === p.id), late = iss.filter(overdue);
    const vw = varsWaiting.filter(v => v.projectId === p.id);
    return `<a class="card" href="#office-weekly"><b>${esc(p.name)}</b><span class="ref">${esc(p.number)}</span>
      <div class="figs"><span><strong>${relDay(last)}</strong>last visit</span><span><strong>${iss.length}</strong>open</span><span class="late"><strong>${late.length}</strong>overdue</span><span><strong>${vw.length}</strong>variations waiting</span></div></a>`;
  }).join('')}</div>`;
}

function officeHome() {
  const sel = toCheck[0];
  const put = lastEvent(sel, 'closure_submitted');
  const group = (ic, title, items, n, row) => `<div class="q-group"><div class="q-h"><span class="ic">${icon(ic)}</span><h3>${title}</h3><em>${n}</em></div>${items.slice(0, 3).map(row).join('')}${n > 3 ? `<a class="q-more" href="#office-issues">Show all ${n}</a>` : ''}</div>`;
  const rRow = r => `<a class="q-item" href="#office-report"><b class="clamp1">${esc(proj(r.projectId).name)} · ${esc(r.author)}</b><time>${relDay(r.date)}</time><span>${short(r.ref)} · ${plural(r.cards.length, 'card')} · ${esc(r.trade)}</span></a>`;
  const cRow = i => { const e = lastEvent(i, 'closure_submitted'); const w = daysBetween(day(e.at), TODAY); return `<a class="q-item ${i === sel ? 'sel' : ''}" href="#office-home"><b class="clamp1">${esc(i.text)}</b><time class="${w > 7 ? 'late' : ''}">${w} days</time><span>${esc(proj(i.projectId).number)} · ${esc(i.location)} · ${esc(e.who)}</span></a>`; };
  const uRow = i => `<a class="q-item" href="#office-issues"><b class="clamp1">${esc(i.text)}</b><time>${ago(day(i.raisedAt))}</time><span>${esc(proj(i.projectId).number)} · ${esc(i.location)} · ${esc(i.trade)}</span></a>`;
  const vRow = v => `<a class="q-item" href="#office-home"><b class="clamp1">${esc(v.text)}</b><time>${ago(day(v.raisedAt))}</time><span>${short(v.ref)} · ${v.workDone ? '<span class="late">work already done</span>' : 'not started'} · ${esc(v.raisedBy)}</span></a>`;
  const waited = daysBetween(day(put.at), TODAY);
  return `<div class="desk">${deskTop('today')}<main class="d-main">
    <div class="d-head"><div><h1>Good afternoon</h1><p>${fmtLong(TODAY)} · oldest first in each list</p></div></div>
    ${projectStrip()}
    <div class="triage">
      <div class="card queue">
        ${group('doc', 'Read new reports', fresh, fresh.length, rRow)}
        ${group('fixed', 'Check fixes put forward', toCheck, toCheck.length, cRow)}
        ${group('person', 'Give issues an owner', unassigned, unassigned.length, uRow)}
        ${group('pound', 'Price or instruct variations', varsWaiting, varsWaiting.length, vRow)}
      </div>
      <section class="card detail">
        <div class="det-kicker"><span class="st blue">Fixed, to check</span><span class="ref">${esc(sel.ref)}</span><span>${esc(proj(sel.projectId).name)}</span></div>
        <h2 class="det-h">${esc(sel.text)}</h2>
        <dl class="det-grid">
          <div><dt>Where</dt><dd>${esc(sel.location)}</dd></div>
          <div><dt>Who fixed it</dt><dd>${esc(sel.owner || '—')}</dd></div>
          <div><dt>Was due</dt><dd>${sel.target ? fmtDay(sel.target) : 'No date'}</dd></div>
          <div><dt>Waiting for you</dt><dd class="${waited > 7 ? 'late' : ''}">${plural(waited, 'day')}</dd></div>
        </dl>
        <div class="det-sec"><h4>Put forward as fixed</h4>
          <div class="put-forward">${photo(132, 96, put.photos ? plural(put.photos, 'photo') : '')}<div><b>${esc(put.who)}, ${fmtDay(day(put.at))}</b>${put.note ? `<p>“${esc(put.note)}”</p>` : ''}<p>What was asked: ${esc(sel.action)}</p></div></div>
        </div>
        <div class="decide"><div class="note">Note for the engineer, needed if you send it back</div><button class="btn">Not finished, send back</button><button class="btn main">${icon('check')} Fixed, close it</button></div>
        <div class="det-sec det-tl"><h4>History</h4><ul>${sel.events.map(e => `<li><time>${fmtDay(day(e.at))}</time><span>${EVENT[e.kind] || e.kind} · ${esc(e.who)}${noteOf(e) ? ` · “${esc(noteOf(e))}”` : ''}</span></li>`).join('')}</ul></div>
      </section>
    </div>
  </main></div>`;
}

function officeIssues() {
  const late = openAll.filter(overdue).sort((a, b) => a.target.localeCompare(b.target));
  const sel = late[0];
  const companies = new Set(openAll.map(i => i.owner).filter(Boolean)).size;
  const views = [['All open', openAll.length, ''], ['Overdue', late.length, 'on'], ['To check', toCheck.length, ''], ['Needs an owner', unassigned.length, ''], ['By company', companies, '']];
  const rows = late.slice(0, 12).map(i => `<tr class="${i === sel ? 'sel' : ''}"><td><span class="ref">${esc(short(i.ref))}</span></td><td><b class="clamp1">${esc(i.text)}</b><small>${esc(i.location)} · ${esc(i.trade)}</small></td><td>${esc(proj(i.projectId).number)}</td><td>${esc(i.owner || '—')}</td><td>${fmtShort(i.target)}<small class="late">${daysBetween(i.target, TODAY)} days late</small></td><td>${stateTag({ ...i, target: '' })}</td></tr>`).join('');
  return `<div class="desk">${deskTop('issues')}<main class="d-main">
    <div class="d-head"><div><h1>Issues</h1><p>${openAll.length} open across ${D.projects.length} projects · ${late.length} overdue · ${toCheck.length} fixed, to check</p></div><div style="display:flex;gap:8px"><button class="btn">Snag list</button><button class="btn">Download spreadsheet</button></div></div>
    <div class="views">${views.map(([l, n, c]) => `<a class="${c}" href="#office-issues">${l}<i>${n}</i></a>`).join('')}<span class="sp"></span><span class="fake-select">All projects ${icon('down')}</span><span class="fake-select">All trades ${icon('down')}</span><span class="fake-select">${icon('search')} Place or company</span></div>
    <div class="reg-wrap">
      <div class="card" style="overflow:hidden"><table class="reg"><colgroup><col style="width:90px"><col><col style="width:80px"><col style="width:150px"><col style="width:120px"><col style="width:150px"></colgroup><thead><tr><th>Ref</th><th>Issue</th><th>Project</th><th>Who’s fixing</th><th>Due</th><th>State</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="reg-foot"><span>Most overdue first · showing 12 of ${late.length}</span><span>Next 12 ›</span></div></div>
      <aside class="card side">
        <div class="det-kicker">${stateTag(sel)}<span class="ref">${esc(sel.ref)}</span></div>
        <h3>${esc(sel.text)}</h3>
        <dl><dt>Project</dt><dd>${esc(proj(sel.projectId).name)}</dd><dt>Where</dt><dd>${esc(sel.location)}</dd><dt>What to do</dt><dd>${esc(sel.action)}</dd><dt>Who</dt><dd>${esc(sel.owner)}</dd><dt>Due</dt><dd>${fmtDay(sel.target)}</dd><dt>Raised</dt><dd>${esc(sel.raisedBy)}, ${fmtDay(day(sel.raisedAt))}</dd></dl>
        <div class="acts"><button class="btn main">Chase ${esc(sel.owner.split(' ')[0])}</button><button class="btn">New date</button><button class="btn">Reassign</button></div>
        <div class="det-sec det-tl"><h4>History</h4><ul>${[...sel.events].reverse().slice(0, 4).map(e => `<li><time>${fmtShort(day(e.at))}</time><span>${EVENT[e.kind] || e.kind} · ${esc(e.who)}</span></li>`).join('')}</ul></div>
      </aside>
    </div>
  </main></div>`;
}

function matchRaised(r) {
  const locs = new Set(r.cards.map(c => c.location));
  return {
    issues: D.issues.filter(i => i.projectId === r.projectId && day(i.raisedAt) === r.date && locs.has(i.location)),
    vars: D.variations.filter(v => v.projectId === r.projectId && day(v.raisedAt) === r.date && locs.has(v.location)),
  };
}
function officeReport() {
  const r = fresh.find(x => x.projectId === SITE && x.type === 'site-update') || fresh[0];
  const pos = fresh.indexOf(r) + 1;
  const p = proj(r.projectId);
  const kinds = r.cards.reduce((m, c) => (m[c.type] = (m[c.type] || 0) + 1, m), {});
  const photos = r.cards.reduce((a, c) => a + c.photos, 0);
  const { issues, vars } = matchRaised(r);
  const prev = D.reports.find(x => x.projectId === r.projectId && x.trade === r.trade && x.date < r.date);
  const kindWords = [['update', 'progress update'], ['defect', 'defect'], ['access', 'access problem'], ['variation', 'variation']].filter(([k]) => kinds[k]).map(([k, w]) => plural(kinds[k], w)).join(', ');
  const area = c => `<div class="area"><div><h3>${esc(c.location)}</h3><span class="kind ${c.type}">${KIND[c.type]}</span></div><div><p>${esc(c.text)}</p>
    ${c.action ? `<div class="needs ${c.type === 'access' ? 'access' : ''}"><b>${c.type === 'access' ? 'Needs clearing' : 'Needs doing'}${c.owner ? ` by ${esc(c.owner)}` : ''}:</b> ${esc(c.action)}</div>` : ''}
    ${c.photos ? `<div class="pics">${Array.from({ length: Math.min(c.photos, 4) }, (_, n) => photo(112, 80, n === 3 && c.photos > 4 ? `+${c.photos - 3}` : '')).join('')}</div>` : ''}</div></div>`;
  return `<div class="desk">${deskTop('reports')}<main class="d-main">
    <div class="read-nav"><a class="btn quiet" href="#office-home">${icon('back')} Today</a><span class="pos">Unread report ${pos} of ${fresh.length}</span><span class="sp"></span><button class="btn">${icon('back')} Previous</button><button class="btn">Skip</button><button class="btn main">Mark as read, next ${icon('arrow')}</button></div>
    <div class="read">
      <article class="card doc">
        <div class="doc-kicker"><span>${esc(p.name)}</span><span>·</span><span>Site update</span><span class="ref">${esc(r.ref)}</span>${r.revision > 1 ? `<span class="st amber">Revision ${r.revision}</span>` : ''}</div>
        <h1>${fmtLong(r.date)} visit</h1>
        <p class="by">${esc(r.author)} · ${esc(r.trade)} · sent ${fmtShort(day(r.at))} at ${time(r.at)}</p>
        <p class="summary"><b>${plural(r.cards.length, 'card')}:</b> ${kindWords} · ${plural(photos, 'photo')}. Raised <b>${plural(issues.length, 'issue')}</b> and <b>${plural(vars.length, 'variation')}</b>.</p>
        ${r.cards.map(area).join('')}
      </article>
      <aside style="display:grid;gap:16px">
        <section class="card raised">
          <h4>What this report raised</h4><p>Kept in step with the issue list</p>
          <ul>${issues.map(i => `<li><b class="clamp2">${esc(i.text)}</b><div><span class="ref">${esc(short(i.ref))} · ${esc(i.location)}</span>${stateTag(i)}</div></li>`).join('') || '<li class="muted">No issues</li>'}
          ${vars.map(v => `<li><b class="clamp2">${esc(v.text)}</b><div><span class="ref">${esc(short(v.ref))}</span><span class="st ${v.instruction === 'pending' ? 'amber' : v.instruction === 'instructed' ? 'green' : ''}">${v.instruction === 'pending' ? 'To price' : v.instruction === 'instructed' ? 'Instructed' : 'Declined'}</span></div></li>`).join('')}</ul>
        </section>
        <section class="card raised delivered">
          <h4>Where it went</h4>
          <div><span>Received in RELAY</span><span class="st green plain">${fmtShort(day(r.at))}, ${time(r.at)}</span></div>
          <div><span>PDF</span><span class="st green plain">Ready</span></div>
          <div><span>Filed to SharePoint</span><span class="st plain">Waiting</span></div>
          <div><span>Seen by the office</span><span class="st amber plain">Not yet</span></div>
        </section>
        ${prev ? `<a class="card raised" href="#office-report"><h4>Previous ${esc(r.trade)} update</h4><p style="margin:0">${fmtDay(prev.date)} · ${esc(prev.author)} · <span class="ref">${esc(short(prev.ref))}</span></p></a>` : ''}
        <div style="display:flex;gap:8px"><button class="btn" style="flex:1">Open PDF</button><button class="btn" style="flex:1">Send a correction</button></div>
      </aside>
    </div>
  </main></div>`;
}

function weekFigures(pid, start) {
  const end = addDays(start, 6);
  const inWk = ymd => ymd >= start && ymd <= end;
  const reps = D.reports.filter(r => r.projectId === pid && r.type === 'site-update' && inWk(r.date));
  const iss = D.issues.filter(i => i.projectId === pid);
  const verifiedOn = i => { const e = lastEvent(i, 'verified'); return e ? day(e.at) : null; };
  const raised = iss.filter(i => inWk(day(i.raisedAt)));
  const closed = iss.filter(i => { const v = verifiedOn(i); return v && inWk(v); });
  const openEnd = iss.filter(i => day(i.raisedAt) <= end && !(verifiedOn(i) && verifiedOn(i) <= end));
  const lateEnd = openEnd.filter(i => i.target && i.target < end);
  const vars = D.variations.filter(v => v.projectId === pid && inWk(day(v.raisedAt)));
  return { start, end, reps, raised, closed, openEnd, lateEnd, vars, people: [...new Set(reps.map(r => r.author))], days: new Set(reps.map(r => r.date)).size };
}
function officeWeekly() {
  const p = proj(SITE);
  const dow = asDate(TODAY).getUTCDay();
  const thisMon = addDays(TODAY, -((dow + 6) % 7));
  const start = addDays(thisMon, -7);
  const w = weekFigures(SITE, start), lw = weekFigures(SITE, addDays(start, -7));
  const areas = {};
  for (const r of w.reps) for (const c of r.cards) if (c.type === 'update') (areas[c.location] ||= []).push({ text: c.text, who: r.trade, day: r.date });
  const areaList = Object.entries(areas).sort((a, b) => b[1].length - a[1].length);
  const shown = areaList.slice(0, 5);
  const value = w.vars.reduce((a, v) => a + (v.value || 0), 0);
  const instructed = w.vars.filter(v => v.instruction === 'instructed');
  const delta = (a, b, goodDown) => { const d = a - b; if (!d) return '<small>same as last week</small>'; const cls = goodDown ? (d > 0 ? 'up' : 'down') : ''; return `<small class="${cls}">${d > 0 ? '+' : '−'}${Math.abs(d)} on last week</small>`; };
  const weeks = Array.from({ length: 6 }, (_, n) => weekFigures(SITE, addDays(start, -7 * (5 - n))));
  const max = Math.max(1, ...weeks.flatMap(x => [x.raised.length, x.closed.length]));
  const names = w.people.map(n => n.split(' ')[0]);
  const lede = `<b>${plural(w.people.length, 'engineer')}</b> (${names.join(', ').replace(/, ([^,]*)$/, ' and $1')}) made <b>${plural(w.reps.length, 'visit')}</b> over ${plural(w.days, 'day')}. Work moved on in <b>${plural(areaList.length, 'area')}</b>, most in ${shown.slice(0, 2).map(a => a[0].replace(/^./, ch => ch.toLowerCase())).join(' and ')}. <b>${w.raised.length}</b> issues were raised and <b>${w.closed.length}</b> closed, leaving <b>${w.openEnd.length}</b> open, <span class="late">${w.lateEnd.length} of them past their date</span>. ${plural(w.vars.length, 'variation')} came in${instructed.length ? `; ${instructed.length} already instructed, worth ${money(value)}` : ''}.`;
  return `<div class="desk">${deskTop('week')}<main class="d-main">
    <div class="d-head"><div><h1>Week in review</h1><p>${esc(p.name)} · ${esc(p.client)}</p></div>
      <div class="wk-switch"><span class="fake-select">${esc(p.name)} ${icon('down')}</span><button class="btn">${icon('back')}</button><span class="fake-select" style="font-weight:600;color:var(--text)">${fmtDay(w.start)} to ${fmtDay(w.end)}</span><button class="btn">${icon('chev')}</button><button class="btn quiet">Month</button></div></div>
    <div class="week">
      <article class="card wk-doc">
        <p class="wk-lede">${lede}</p>
        <dl class="nums">
          <div><dt>Site visits</dt><dd>${w.reps.length}</dd>${delta(w.reps.length, lw.reps.length)}</div>
          <div><dt>Issues raised</dt><dd>${w.raised.length}</dd>${delta(w.raised.length, lw.raised.length, true)}</div>
          <div><dt>Issues closed</dt><dd>${w.closed.length}</dd>${delta(w.closed.length, lw.closed.length)}</div>
          <div><dt>Open at week end</dt><dd>${w.openEnd.length}</dd><small class="up">${w.lateEnd.length} overdue</small></div>
          <div><dt>Variations</dt><dd>${w.vars.length}</dd><small>${instructed.length ? `${money(value)} instructed` : 'none instructed yet'}</small></div>
        </dl>
        <section class="wk-sec"><h2>Done this week, by area <span>${plural(areaList.length, 'area')}</span></h2>
          ${shown.map(([loc, items]) => `<div class="done-area"><h3>${esc(loc)}</h3><ul>${items.slice(0, 2).map(x => `<li>${esc(x.text)} <small>· ${esc(x.who)}, ${DOW[asDate(x.day).getUTCDay()]}</small></li>`).join('')}${items.length > 2 ? `<li class="muted">and ${items.length - 2} more</li>` : ''}</ul></div>`).join('')}
          ${areaList.length > shown.length ? `<div class="done-area"><h3 class="muted">${areaList.length - shown.length} more areas</h3><div class="muted">${areaList.slice(shown.length).map(a => esc(a[0])).join(', ')}</div></div>` : ''}
        </section>
        <section class="wk-sec"><h2>Issues raised and closed <span class="legend"><span class="o">Raised</span><span class="c">Closed</span></span></h2>
          <div class="chart">${weeks.map((x, n) => `<div class="wk ${n === 5 ? 'on' : ''}"><div class="bars"><i class="o" style="height:${x.raised.length / max * 100}%" title="${x.raised.length} raised"></i><i class="c" style="height:${x.closed.length / max * 100}%" title="${x.closed.length} closed"></i></div><small>${fmtShort(x.start)}</small></div>`).join('')}</div>
        </section>
        <section class="wk-sec"><h2>Variations this week <span>${plural(w.vars.length, 'variation')}</span></h2>
          ${w.vars.slice(0, 6).map(v => `<div class="vrow"><span class="ref">${esc(short(v.ref))}</span><span class="clamp1">${esc(v.text)}</span><span class="st ${v.instruction === 'pending' ? 'amber' : v.instruction === 'instructed' ? 'green' : ''}">${v.instruction === 'pending' ? (v.workDone ? 'Done, not instructed' : 'To price') : v.instruction === 'instructed' ? 'Instructed' : 'Declined'}</span><span class="v">${v.value ? money(v.value) : '—'}</span></div>`).join('')}
        </section>
      </article>
      <aside style="display:grid;gap:16px">
        <section class="card send">
          <h3>Send to the client</h3><p>This page, laid out as a PDF with the Leodis logo and accreditations.</p>
          <div class="to"><span>To</span>${esc(p.pm)}, project manager<br><span>${esc(p.client)}</span></div>
          <div class="pages">${[0, 1, 2].map(n => `<div>${n === 0 ? '<i class="g"></i><i class="t"></i>' : '<i class="t"></i>'}<i></i><i></i><i style="width:70%"></i><i></i><i style="width:50%"></i></div>`).join('')}</div>
          <button class="btn main">Download PDF</button><button class="btn">Copy the summary</button>
          <hr>
          <h3>Other projects this week</h3>
          <div class="others" style="margin-top:6px">${D.projects.filter(x => x.id !== SITE).map(x => { const f = weekFigures(x.id, start); return `<a href="#office-weekly"><span>${esc(x.name)}</span><span class="muted">${plural(f.reps.length, 'visit')} · ${f.raised.length} raised</span></a>`; }).join('')}</div>
        </section>
      </aside>
    </div>
  </main></div>`;
}

const ROUTES = { 'eng-home': engHome, 'eng-update': engUpdate, 'eng-issue': engIssue, 'office-home': officeHome, 'office-issues': officeIssues, 'office-report': officeReport, 'office-weekly': officeWeekly };
function render() {
  const id = location.hash.slice(1);
  const fn = ROUTES[id] || (innerWidth < 700 ? engHome : officeHome);
  document.getElementById('app').innerHTML = fn();
  document.title = `RELAY · Concept A, Today · ${id || 'home'}`;
  scrollTo(0, 0);
}
addEventListener('hashchange', render);
render();
})();
