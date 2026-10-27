/* Concept B: Site rooms. Renders seven screens from window.RELAY_DATA, one per hash route. */
(() => {
const D = window.RELAY_DATA;
const TODAY = D.today;
const ME = D.people.engineer.name;
const HOME = 'proj-011lme';

// ── Helpers ─────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const proj = (id) => D.projects.find((p) => p.id === id);
const short = (name) => name.split(' - ')[0];
const tradeCls = (t) => (t === 'P&H' ? 'PH' : t || '');
const tradeOf = (name) => Object.values(D.people).find((p) => p.name === name)?.trade || '';
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const av = (name, size = '', trade) => `<span class="av ${size} ${tradeCls(trade ?? tradeOf(name))}" title="${esc(name)}">${initials(name)}</span>`;
const HUES = [55, 75, 95, 125, 160, 195, 225, 250];
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 997; return HUES[h % HUES.length]; };
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const photo = (loc, { cap = '', more = 0, cls = '', seed = 0 } = {}) => `<div class="ph ${cls}" style="--h:${HUES[(HUES.indexOf(hue(loc)) + seed * 3) % HUES.length]}">${CAM}${cap ? `<span class="cap">${esc(cap)}</span>` : ''}${more ? `<span class="more">+${more}</span>` : ''}</div>`;
const d = (s) => new Date(`${s.slice(0, 10)}T12:00:00Z`);
const addDays = (s, n) => { const x = d(s); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((d(b) - d(a)) / 86400000);
const fmtDay = (s) => d(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDate = (s) => d(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const londonDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const when = (iso) => { const day = londonDay(iso); if (day === TODAY) return fmtTime(iso); if (day === addDays(TODAY, -1)) return `Yesterday ${fmtTime(iso)}`; return `${fmtDay(day)}`; };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const KIND = { update: 'Progress', defect: 'Defect', instruction: 'Variation', access: 'Access', check: 'Check' };
const kind = (t) => `<span class="kind ${t}">${KIND[t] || t}</span>`;
const kindCount = (t, n) => `${n} ${KIND[t].toLowerCase()}${n > 1 && ['defect', 'instruction', 'check'].includes(t) ? 's' : ''}`;
const listNames = (a) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`;

// ── Figures ─────────────────────────────────────────────────────────
const live = (i) => i.confirmation !== 'withdrawn';
const isOpen = (i) => live(i) && i.work !== 'closed';
const isOverdue = (i) => isOpen(i) && i.work !== 'awaiting_verification' && i.target && i.target < TODAY;
const issuesOf = (pid) => D.issues.filter((i) => i.projectId === pid);
const reportsOf = (pid) => D.reports.filter((r) => r.projectId === pid);
function figures(pid) {
  const is = pid ? issuesOf(pid) : D.issues, rs = pid ? reportsOf(pid) : D.reports;
  const vs = D.variations.filter((v) => !pid || v.projectId === pid);
  return {
    open: is.filter(isOpen).length,
    overdue: is.filter(isOverdue).length,
    toCheck: is.filter((i) => live(i) && i.work === 'awaiting_verification').length,
    unowned: is.filter((i) => live(i) && i.work === 'open').length,
    varsWaiting: vs.filter((v) => v.instruction === 'pending').length,
    varsDone: vs.filter((v) => v.instruction === 'pending' && v.workDone).length,
    unseen: rs.filter((r) => !r.seen).length,
    lastVisit: rs.map((r) => r.date).sort().at(-1),
    onSite: [...new Set(rs.filter((r) => r.date === TODAY).map((r) => r.author))],
  };
}
function issueState(i) {
  if (i.sentBack) return '<span class="pill amber">Sent back to you</span>';
  if (i.work === 'closed') return '<span class="pill green">Closed</span>';
  if (i.work === 'awaiting_verification') return '<span class="pill amber">Fixed, to check</span>';
  if (isOverdue(i)) { const n = daysBetween(i.target, TODAY); return `<span class="pill red">${n} ${n === 1 ? 'day' : 'days'} late</span>`; }
  if (i.work === 'open') return '<span class="pill grey">Nobody owns it</span>';
  if (i.work === 'in_progress') return '<span class="pill blue">Being fixed</span>';
  return '<span class="pill blue">With the trade</span>';
}
const EVENT_WORDS = { raised: 'raised', confirmation: 'confirmed', assigned: 'passed to the trade', progress: 'updated', closure_submitted: 'put forward as fixed', verified: 'checked and closed', reopened: 'sent back' };

// ── Shared bits ─────────────────────────────────────────────────────
const ICON = {
  room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  place: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  issue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
};
function tabbar(on) {
  const mine = D.issues.filter((i) => i.sentBack).length;
  const t = [['room', 'Room', 'eng-home'], ['place', 'Places', 'eng-home'], ['issue', 'Issues', 'eng-issue'], ['me', 'My week', 'eng-home']];
  return `<nav class="tabbar" aria-label="Main">${t.map(([k, label, href]) => `<a href="#${href}" class="${k === on ? 'on' : ''}">${ICON[k]}${k === 'issue' && mine ? `<span class="n">${mine}</span>` : ''}${label}</a>`).join('')}</nav>`;
}
function officeTop(on) {
  const f = figures();
  const nav = [['office-home', 'Rooms', ''], ['office-report', 'Reports', f.unseen ? `<span class="n">${f.unseen} new</span>` : ''], ['office-issues', 'Issues', `<span class="n hot">${f.overdue} late</span>`], ['office-home', 'Variations', `<span class="n">${f.varsWaiting}</span>`], ['office-weekly', 'Week', '']];
  return `<header class="o-top"><div class="in"><span class="brand">RELAY</span><nav>${nav.map(([h, l, n]) => `<a href="#${h}" class="${l === on ? 'on' : ''}">${l}${n}</a>`).join('')}</nav><div class="search">${ICON.search}Search a place, issue, report or person</div><div class="me">${av('Office Manager', 'sm', '')}Office Manager</div></div></header>`;
}
function post(r, { compact = false } = {}) {
  const withPhotos = r.cards.filter((c) => c.photos);
  const first = r.cards.find((c) => c.type === 'update') || r.cards[0];
  const counts = Object.entries(r.cards.reduce((m, c) => (m[c.type] = (m[c.type] || 0) + 1, m), {}));
  const tiles = withPhotos.slice(0, 3);
  const totalPhotos = r.cards.reduce((n, c) => n + c.photos, 0);
  return `<article class="post">${av(r.author, '', r.trade)}<div class="post-body">
    <div class="post-meta"><b>${esc(r.author)}</b><span>${esc(r.trade)} · ${when(r.at)}</span></div>
    <p class="post-text"><span class="loc">${esc(first.location)}.</span> ${esc(first.text)}</p>
    ${tiles.length ? `<div class="post-photos">${tiles.map((c, i) => photo(c.location, { cap: i === 0 ? c.location : '', more: i === 2 && totalPhotos > 3 ? totalPhotos - 3 : 0 })).join('')}${tiles.length < 3 ? '<span></span>'.repeat(3 - tiles.length) : ''}</div>` : ''}
    <div class="post-foot">${counts.map(([t, n]) => `<span class="kind ${t}">${kindCount(t, n)}</span>`).join('')}${compact ? '' : `<span class="chip">${plural(r.cards.length, 'card')}</span>`}</div>
  </div></article>`;
}
function eventLine(i, e) {
  const c = { raised: 'var(--red)', closure_submitted: 'var(--amber)', verified: 'var(--green)', reopened: 'var(--gold)' }[e.kind] || 'var(--text-3)';
  return `<div class="event"><div class="ico" style="--c:${c}"><i></i></div><p><b>${esc(e.who)}</b> ${EVENT_WORDS[e.kind] || e.kind} <span class="ref">${esc(i.ref.split('-').slice(1).join('-'))}</span> · ${esc(i.location)}<br><span class="muted">${when(e.at)}</span></p></div>`;
}
function timeline(pid, { days = [TODAY], limit = 8, compactPosts = false } = {}) {
  const items = [];
  for (const r of D.reports) if ((!pid || r.projectId === pid) && days.includes(r.date)) items.push({ at: r.at, html: post(r, { compact: compactPosts }) });
  for (const i of D.issues) if (!pid || i.projectId === pid) for (const e of i.events) if (days.includes(londonDay(e.at)) && (e.kind === 'verified' || (['raised', 'closure_submitted'].includes(e.kind) && e.who !== 'Office Manager'))) items.push({ at: e.at, html: eventLine(i, e) });
  const seen = new Set();
  return items.sort((a, b) => b.at.localeCompare(a.at)).filter((x) => !seen.has(x.html) && seen.add(x.html)).slice(0, limit).map((x) => x.html).join('');
}

// ── Engineer: the room ──────────────────────────────────────────────
function engHome() {
  const p = proj(HOME), f = figures(HOME);
  const replies = D.issues.filter((i) => i.sentBack && i.raisedBy === ME);
  const draft = D.draft, photos = draft.cards.reduce((n, c) => n + c.photos, 0);
  const todayItems = timeline(HOME, { days: [TODAY], limit: 4, compactPosts: true });
  const yday = addDays(TODAY, -1);
  return `<div class="phone">
    <div class="p-top"><span class="brand">RELAY</span><span class="sp"></span>${av(ME, 'sm', 'Electrical')}</div>
    <div class="rooms-switch" role="group" aria-label="Your rooms">${D.projects.map((q) => `<button aria-pressed="${q.id === HOME}"><span class="dot">${q.number.slice(0, 3)}</span>${esc(short(q.name))}</button>`).join('')}</div>
    <div class="room-head"><h1>${esc(p.name)}</h1><p><span class="ref">${p.number}</span> · ${esc(p.pm)}, project manager · ${f.onSite.length ? `${listNames(f.onSite.map((n) => n.split(' ')[0]))} on site today` : 'nobody else on site yet'}</p></div>

    <section class="card compose" aria-label="Today's update">
      <div class="compose-q">${av(ME, '', 'Electrical')}<a class="bubble" href="#eng-update">What did you do today?</a></div>
      <a class="today-update" href="#eng-update"><div class="strip">${draft.cards.slice(0, 3).map((c) => photo(c.location)).join('')}</div><div><b>Today's update</b><small>${plural(draft.cards.length, 'card')} · ${plural(photos, 'photo')} · saved 13:32</small></div><span class="btn gold go">Carry on with today's update</span></a>
      <div class="quick"><button>+ Progress<small>what you did</small></button><button>+ Defect<small>goes straight in</small></button><button>+ Variation<small>extra work</small></button></div>
    </section>

    ${replies.length ? `<div class="sec"><h2>The office replied</h2><span>${plural(replies.length, 'message')}</span></div>
    ${replies.map((i) => { const e = i.events.at(-1); return `<article class="card reply"><div class="who">${av(e.who, 'sm', '')}<span><b>${esc(e.who)}</b> · ${when(e.at)}</span></div><div class="msg">${esc(e.note)}</div><div class="about"><span>About</span><span class="chip place" style="--h:${hue(i.location)}">${esc(i.location)}</span><span>${esc(i.text.slice(0, 48))}…</span></div><div class="acts"><a class="btn" href="#eng-issue">Reply</a><a class="btn gold" href="#eng-issue">Send a photo</a></div></article>`; }).join('')}` : ''}

    <div class="sec"><h2>Today in this room</h2><span>${fmtDay(TODAY)}</span></div>
    <div class="tl">${todayItems || '<p class="muted">Nothing posted yet today.</p>'}</div>
    <div class="sec"><h2>Yesterday</h2><span>${fmtDay(yday)}</span></div>
    <div class="tl">${timeline(HOME, { days: [yday], limit: 3, compactPosts: true })}</div>
  </div>${tabbar('room')}`;
}

// ── Engineer: composing today's update ──────────────────────────────
function engUpdate() {
  const p = proj(HOME), draft = D.draft;
  const photos = draft.cards.reduce((n, c) => n + c.photos, 0);
  const recent = [...new Set(reportsOf(HOME).filter((r) => r.author === ME).flatMap((r) => r.cards.map((c) => c.location)))].filter((l) => !draft.cards.some((c) => c.location === l)).slice(0, 5);
  const entry = (c, n) => `<article class="card entry">
    <div class="entry-row">${kind(c.type)}<span class="chip place" style="--h:${hue(c.location)}">${esc(c.location)}</span><span class="num">${n + 1} of ${draft.cards.length}</span></div>
    <div class="entry-photos">${Array.from({ length: Math.min(c.photos, 2) }, (_, k) => photo(c.location, { seed: k, more: k === 1 && c.photos > 2 ? c.photos - 2 : 0 })).join('')}<button class="add">${CAM}Add photo</button></div>
    <div class="entry-text">${esc(c.text)}</div>
    ${c.type !== 'update' ? `<div class="entry-sub"><b>${c.type === 'defect' ? 'Needs doing' : c.type === 'access' ? 'What would help' : 'Extra work'}:</b> ${esc(c.action)}${c.owner ? ` · <b>${esc(c.owner)}</b>` : ''}</div>` : ''}
  </article>`;
  return `<div class="phone">
    <div class="c-top"><a class="btn ghost" href="#eng-home" aria-label="Back to the room">${ICON.back}</a><div class="ttl"><b>Today's update</b><small>${esc(short(p.name))} · ${fmtDay(TODAY)} · <span class="ref">${draft.ref}</span></small></div><span class="saved">Saved</span></div>
    ${draft.cards.map(entry).join('')}
    <section class="card add-to"><h3>Add to this update</h3>
      <div class="types"><button style="--c:var(--text-3)"><i></i><span>Progress<small>What got done</small></span></button><button style="--c:var(--red)"><i></i><span>Defect<small>Someone must fix it</small></span></button><button style="--c:var(--amber)"><i></i><span>Variation<small>Extra work asked for</small></span></button><button style="--c:var(--blue)"><i></i><span>Access<small>Something held you up</small></span></button></div>
      <div class="muted" style="font-size:13px">Places you've worked here</div>
      <div class="places">${recent.map((l) => `<span class="chip place" style="--h:${hue(l)}">${esc(l)}</span>`).join('')}</div>
    </section>
  </div>
  <div class="sendbar"><div class="in"><small><span>${plural(draft.cards.length, 'card')} · ${plural(photos, 'photo')}</span><span>Goes to ${esc(p.pm)} and the office</span></small><button class="btn gold big">Send today's update</button></div></div>`;
}

// ── Engineer: an issue as a conversation ────────────────────────────
function engIssue() {
  const i = D.issues.find((x) => x.sentBack && x.raisedBy === ME);
  const p = proj(i.projectId), late = i.target && i.target < TODAY;
  const rows = i.events.map((e, n) => {
    const mine = e.who === ME;
    if (e.kind === 'confirmation') return `<div class="sys"><b>${esc(e.who)}</b> confirmed it · ${fmtDay(londonDay(e.at))}</div>`;
    if (e.kind === 'assigned') return `<div class="sys">Passed to <b>${esc(i.owner)}</b> to fix by ${fmtDate(i.target)}</div>`;
    const text = e.kind === 'raised' ? (i.text) : (e.note || EVENT_WORDS[e.kind]);
    const label = e.kind === 'raised' ? 'Raised it' : e.kind === 'closure_submitted' ? 'Put it forward as fixed' : e.kind === 'reopened' ? 'Sent it back' : 'Update';
    return `<div class="msg-row ${mine ? 'me' : ''}">${mine ? '' : av(e.who, 'sm')}<div class="bub ${e.kind === 'reopened' ? 'hl' : ''}"><small>${mine ? 'You' : esc(e.who)} · ${label} · ${when(e.at)}</small><p>${esc(text)}</p>${e.photos || e.kind === 'raised' ? photo(i.location, { cap: e.kind === 'raised' ? i.location : 'Fix photo' }) : ''}</div></div>`;
  }).join('');
  return `<div class="phone" style="padding-bottom:150px">
    <div class="c-top"><a class="btn ghost" href="#eng-home" aria-label="Back to the room">${ICON.back}</a><div class="ttl"><b>${esc(short(p.name))}</b><small>Issue <span class="ref">${i.ref}</span></small></div>${issueState(i)}</div>
    ${(() => { const e = i.events.at(-1); return e.kind === 'reopened' ? `<article class="card reply" style="margin-top:14px"><div class="who">${av(e.who, 'sm', '')}<span><b>${esc(e.who)}</b> sent it back · ${when(e.at)}</span></div><div class="msg">${esc(e.note)}</div></article>` : ''; })()}
    <div class="i-head"><h1>${esc(i.text)}</h1><div class="entry-row"><span class="chip place" style="--h:${hue(i.location)}">${esc(i.location)}</span><span class="chip">${esc(i.trade)}</span></div>
      <dl class="facts"><div><dt>Needs doing</dt><dd>${esc(i.action)}</dd></div><div><dt>Who is fixing it</dt><dd>${esc(i.owner)}</dd></div><div><dt>Fix by</dt><dd class="${late ? 'late' : ''}">${fmtDay(i.target)}${late ? ` · ${plural(daysBetween(i.target, TODAY), 'day')} late` : ''}</dd></div><div><dt>Raised</dt><dd>${fmtDay(londonDay(i.raisedAt))} by you</dd></div></dl>
    </div>
    <div class="sec"><h2>What has happened</h2><span>${plural(i.events.length, 'step')}</span></div>
    <div class="thread" style="margin-top:0">${rows}</div>
  </div>
  <div class="composer"><div class="in"><button class="btn gold big">Mark as fixed, with a photo</button><div class="row"><div class="field">Reply to the office…</div><button class="cam" aria-label="Add a photo">${CAM}</button></div></div></div>`;
}

// ── Office: the rooms ───────────────────────────────────────────────
function roomCard(p) {
  const f = figures(p.id), rs = reportsOf(p.id);
  const tiles = rs.flatMap((r) => r.cards.filter((c) => c.photos).map((c) => c.location)).filter((l, k, a) => a.indexOf(l) === k).slice(0, 9);
  const lastDay = f.lastVisit, dayReports = rs.filter((r) => r.date === lastDay);
  const defects = dayReports.flatMap((r) => r.cards).filter((c) => c.type === 'defect').length;
  const fixed = issuesOf(p.id).flatMap((i) => i.events).filter((e) => e.kind === 'closure_submitted' && londonDay(e.at) === lastDay).length;
  const dayWord = lastDay === TODAY ? 'Today' : lastDay === addDays(TODAY, -1) ? 'Yesterday' : fmtDay(lastDay);
  const who = [...new Set(dayReports.map((r) => r.author))];
  const status = p.status === 'Active' ? '<span class="pill green">On site</span>' : `<span class="pill grey">${esc(p.status)}</span>`;
  return `<article class="card room">
    <div class="room-top"><div><h2>${esc(p.name)}</h2><p><span class="ref">${p.number}</span> · ${esc(p.client)} · ${esc(p.pm)}</p></div><div class="r">${status}<a class="btn" href="#office-weekly">The week</a><a class="btn" href="#office-issues">Open room</a></div></div>
    <div class="room-photos">${tiles.map((l, k) => photo(l, { cap: k === 0 ? l : '' })).join('')}</div>
    <div class="room-mid"><div class="changed"><b>${dayWord}:</b> ${plural(dayReports.length, 'site update')} from ${listNames(who)}, ${plural(defects, 'defect')} found${fixed ? `, ${plural(fixed, 'fix', 'fixes')} put forward` : ''}.</div><div class="onsite">${who.length ? `<span class="avs">${who.map((n) => av(n, 'sm')).join('')}</span>${dayWord === 'Today' ? 'on site today' : 'last on site'}` : ''}</div></div>
    <div class="counts">
      <a href="#office-report"><b>${f.unseen}</b><small>New reports</small></a>
      <a href="#office-issues"><b>${f.open}</b><small>Open issues</small></a>
      <a href="#office-issues"><b class="${f.overdue ? 'red' : ''}">${f.overdue}</b><small>Late</small></a>
      <a href="#office-issues"><b>${f.toCheck}</b><small>Fixes to check</small></a>
      <a href="#office-issues"><b>${f.unowned}</b><small>Nobody owns</small></a>
      <a href="#office-home"><b>${f.varsWaiting}</b><small>Variations to price</small></a>
    </div>
  </article>`;
}
function officeHome() {
  const f = figures();
  const people = new Set(D.reports.filter((r) => r.date >= addDays(TODAY, -6)).map((r) => r.author));
  const split = (fn) => D.projects.map((p) => [short(p.name), fn(figures(p.id))]).filter(([, n]) => n).map(([n, c]) => `${n} ${c}`).join(' · ');
  const hour = 13;
  return `${officeTop('Rooms')}<main class="o-wrap">
    <div class="o-hello"><h1>Good afternoon</h1><p>${plural(D.projects.length, 'room')}, ${plural(people.size, 'engineer')} on site this week. ${plural(f.onSite.length, 'person', 'people')} have posted today.</p></div>
    <div class="o-grid">
      <div>${D.projects.map(roomCard).join('')}</div>
      <aside class="side">
        <section class="card waiting"><h3>Waiting on you</h3>
          <a href="#office-report"><span class="ic gold">${f.unseen}</span><div><b>Reports nobody has opened</b><small>${split((x) => x.unseen)}</small></div><span class="chev">›</span></a>
          <a href="#office-issues"><span class="ic amber">${f.toCheck}</span><div><b>Fixes to check</b><small>${split((x) => x.toCheck)}</small></div><span class="chev">›</span></a>
          <a href="#office-issues"><span class="ic">${f.unowned}</span><div><b>Issues nobody owns</b><small>${split((x) => x.unowned)}</small></div><span class="chev">›</span></a>
          <a href="#office-home"><span class="ic">${f.varsWaiting}</span><div><b>Variations to price</b><small>${f.varsDone} already done on site</small></div><span class="chev">›</span></a>
          <a href="#office-issues"><span class="ic red">${f.overdue}</span><div><b>Issues past their date</b><small>${split((x) => x.overdue)}</small></div><span class="chev">›</span></a>
        </section>
        <section class="card feed"><h3>Across all rooms</h3><div class="tl">${timeline(null, { days: [TODAY, addDays(TODAY, -1)], limit: 6, compactPosts: true })}</div></section>
      </aside>
    </div>
  </main>`;
}

// ── Office: issues by place ─────────────────────────────────────────
function thread(i) {
  return i.events.map((e) => {
    if (e.kind === 'confirmation') return `<div class="sys"><b>${esc(e.who)}</b> confirmed it · ${fmtDay(londonDay(e.at))}</div>`;
    if (e.kind === 'assigned') return `<div class="sys">Passed to <b>${esc(i.owner || 'the trade')}</b> · ${fmtDay(londonDay(e.at))}</div>`;
    const office = e.who === 'Office Manager';
    return `<div class="msg-row ${office ? 'me' : ''}">${office ? '' : av(e.who, 'sm')}<div class="bub"><small>${office ? 'You' : esc(e.who)} · ${EVENT_WORDS[e.kind] || e.kind} · ${when(e.at)}</small><p>${esc(e.kind === 'raised' ? i.text : e.note || EVENT_WORDS[e.kind])}</p>${e.photos ? photo(i.location, { cap: e.kind === 'raised' ? i.location : 'Photo' }) : ''}</div></div>`;
  }).join('');
}
function officeIssues() {
  const p = proj(HOME), all = issuesOf(HOME), open = all.filter(isOpen);
  const groups = Object.entries(open.reduce((m, i) => ((m[i.location] ||= []).push(i), m), {}))
    .map(([loc, list]) => ({ loc, list: list.sort((a, b) => (isOverdue(b) - isOverdue(a)) || (a.target || '').localeCompare(b.target || '')), late: list.filter(isOverdue).length }))
    .sort((a, b) => b.late - a.late || b.list.length - a.list.length);
  const sel = groups[0].list[0];
  const f = figures(HOME);
  const trades = ['Electrical', 'HVAC', 'P&H'].map((t) => [t, open.filter((i) => i.trade === t).length]);
  const closedMonth = all.filter((i) => i.work === 'closed').length;
  return `${officeTop('Issues')}<main class="o-wrap"><div class="iss-layout">
    <aside class="rail">
      <div><h3>Room</h3>${D.projects.map((q) => `<div class="opt ${q.id === HOME ? 'on' : ''}">${esc(short(q.name))}<span>${figures(q.id).open}</span></div>`).join('')}<div class="opt">Every room<span>${figures().open}</span></div></div>
      <div><h3>Show</h3><div class="opt on" style="--c:var(--text)"><i class="sw"></i>Open<span>${f.open}</span></div><div class="opt" style="--c:var(--red)"><i class="sw"></i>Late<span>${f.overdue}</span></div><div class="opt" style="--c:var(--amber)"><i class="sw"></i>Fixed, to check<span>${f.toCheck}</span></div><div class="opt" style="--c:var(--text-3)"><i class="sw"></i>Nobody owns it<span>${f.unowned}</span></div><div class="opt" style="--c:var(--green)"><i class="sw"></i>Closed lately<span>${closedMonth}</span></div></div>
      <div><h3>Trade</h3>${trades.map(([t, n]) => `<div class="opt">${av(t, 'sm', t)}${t}<span>${n}</span></div>`).join('')}</div>
    </aside>
    <section>
      <div class="iss-head"><div><h1>Issues at ${esc(short(p.name))}</h1><p>${f.open} open in ${plural(groups.length, 'place')} · <span style="color:var(--red)">${f.overdue} late</span> · ${f.toCheck} fixed, to check</p></div><div class="r"><div class="toggle"><span class="on">By place</span><span>Table</span></div><a class="btn">Snag list</a><a class="btn">Spreadsheet</a></div></div>
      ${groups.slice(0, 7).map((g) => `<div class="card placegrp"><div class="place-h">${photo(g.loc)}<div><b>${esc(g.loc)}</b><small>${plural(g.list.length, 'open issue')}${g.late ? ` · <span style="color:var(--red)">${g.late} late</span>` : ''}</small></div><div class="r"><span class="chip">${[...new Set(g.list.map((i) => i.owner).filter(Boolean))].length} companies</span></div></div>
        ${g.list.slice(0, 4).map((i) => `<div class="irow ${i === sel ? 'sel' : ''}"><div class="t">${esc(i.text)}</div><div class="s">${issueState(i)}</div><div class="m"><span class="ref">${i.ref}</span><span>${esc(i.owner || 'Nobody yet')}</span><span>${esc(i.trade)}</span>${i.target ? `<span class="${isOverdue(i) ? 'late' : ''}">fix by ${fmtDate(i.target)}</span>` : ''}</div></div>`).join('')}
        ${g.list.length > 4 ? `<div class="irow"><div class="m">${g.list.length - 4} more here</div></div>` : ''}</div>`).join('')}
    </section>
    <aside class="card panel">
      <div class="panel-h"><div class="entry-row"><span class="ref">${sel.ref}</span>${issueState(sel)}</div><h2>${esc(sel.text)}</h2><div class="entry-row"><span class="chip place" style="--h:${hue(sel.location)}">${esc(sel.location)}</span><span class="chip">${esc(sel.owner || 'Nobody yet')}</span><span class="chip">${esc(sel.trade)}</span></div></div>
      <div class="panel-b">${thread(sel)}</div>
      <div class="panel-f"><div class="row"><div class="field">Write to ${esc(sel.raisedBy.split(' ')[0] || 'the engineer')} or the trade…</div></div><div class="row"><button class="btn" style="flex:1">Change who fixes it</button><button class="btn gold" style="flex:1">Mark as checked</button></div></div>
    </aside>
  </div></main>`;
}

// ── Office: reading a report ────────────────────────────────────────
function officeReport() {
  const list = D.reports.slice(0, 11);
  const r = D.reports.find((x) => x.projectId === HOME && x.cards.length >= 5) || D.reports[0];
  const p = proj(r.projectId);
  const prev = D.reports.find((x) => x.projectId === r.projectId && x.trade === r.trade && x.date < r.date);
  const counts = Object.entries(r.cards.reduce((m, c) => (m[c.type] = (m[c.type] || 0) + 1, m), {}));
  const photos = r.cards.reduce((n, c) => n + c.photos, 0);
  const follow = (c) => {
    if (c.type === 'defect' || c.type === 'access') {
      const i = D.issues.find((x) => x.projectId === r.projectId && x.location === c.location && londonDay(x.raisedAt) === r.date);
      return i ? `<div class="conseq">Became <a href="#office-issues">${i.ref}</a> ${issueState(i)}${i.owner ? `<span>with ${esc(i.owner)}</span>` : ''}</div>` : '<div class="conseq"><span class="pill grey">No issue raised</span></div>';
    }
    if (c.type === 'instruction') {
      const v = D.variations.find((x) => x.projectId === r.projectId && x.location === c.location && londonDay(x.raisedAt) === r.date);
      return v ? `<div class="conseq">Became <a href="#office-home">${v.ref}</a> <span class="pill ${v.instruction === 'pending' ? 'amber' : v.instruction === 'instructed' ? 'green' : 'grey'}">${v.instruction === 'pending' ? 'To price' : v.instruction === 'instructed' ? 'Instructed' : 'Declined'}</span></div>` : '';
    }
    return '';
  };
  return `${officeTop('Reports')}<main class="o-wrap"><div class="rd-layout">
    <aside class="card list"><h3>Latest from site <span>${figures().unseen} not opened</span></h3>${list.map((x) => `<a class="li ${x === r ? 'sel' : ''}" href="#office-report"><span class="new ${x.seen ? 'off' : ''}"></span>${av(x.author, 'sm', x.trade)}<div><b>${esc(x.author)} · ${esc(short(proj(x.projectId).name))}</b><small>${when(x.at)} · ${plural(x.cards.length, 'card')} · ${esc(x.cards[0].location)}</small></div></a>`).join('')}</aside>
    <article class="card rd-post">
      <div class="rd-head">${av(r.author, 'lg', r.trade)}<div><h1>${esc(r.author)} at ${esc(short(p.name))}</h1><p>${esc(r.trade)} · site update for ${fmtDay(r.date)}, sent ${fmtTime(r.at)} · <span class="ref">${r.ref}</span></p></div><div class="r"><a class="btn">PDF</a><a class="btn">Open the room</a></div></div>
      <div class="rd-sum">${counts.map(([t, n]) => `<span class="kind ${t}">${kindCount(t, n)}</span>`).join('')}<span class="chip">${plural(photos, 'photo')}</span><span class="chip">${plural(new Set(r.cards.map((c) => c.location)).size, 'place')}</span></div>
      ${r.cards.map((c, k) => `<section class="rd-card ${c.photos ? '' : 'nophoto'}">${c.photos ? `<div class="rd-photos">${Array.from({ length: Math.min(c.photos, 3) }, (_, n) => photo(c.location, { seed: n, cls: c.photos === 1 || (n === 0 && c.photos === 3) ? 'wide' : '' })).join('')}</div>` : ''}<div class="rd-text"><div class="entry-row">${kind(c.type)}<span class="chip place" style="--h:${hue(c.location)}">${esc(c.location)}</span>${c.trade ? `<span class="chip">${esc(c.trade)}</span>` : ''}</div><h3>${esc(c.location)}</h3><p>${esc(c.text)}</p>${c.action ? `<div class="act"><b>Needs doing:</b> ${esc(c.action)}${c.owner ? ` · <b>${esc(c.owner)}</b>` : ''}</div>` : ''}${follow(c)}</div></section>`).join('')}
    </article>
    <aside class="side">
      <section class="card steps"><h3>Where this report is</h3>
        <div class="step"><i>✓</i><div><b>Received</b><small>${fmtDay(r.date)}, ${fmtTime(r.at)} · saved in RELAY</small></div></div>
        <div class="step"><i>✓</i><div><b>PDF made</b><small>Branded, ${plural(r.cards.length, 'card')}, ${plural(photos, 'photo')}</small></div></div>
        <div class="step wait"><i>·</i><div><b>Filed to SharePoint</b><small>Waiting to send, as on the pilot</small></div></div>
        <div class="step ${r.seen ? '' : 'wait'}"><i>${r.seen ? '✓' : '·'}</i><div><b>${r.seen ? 'Seen by the office' : 'Not opened yet'}</b><small>${r.seen ? 'Opened by Office Manager' : 'Opening it marks it seen'}</small></div></div>
      </section>
      ${prev ? `<section class="card waiting"><h3>Before this</h3><a href="#office-report">${av(prev.author, 'sm', prev.trade)}<div><b>${esc(prev.author)}, ${fmtDay(prev.date)}</b><small>${daysBetween(prev.date, r.date)} days before · ${plural(prev.cards.length, 'card')}</small></div><span class="chev">›</span></a></section>` : ''}
    </aside>
  </div></main>`;
}

// ── Office: the week at a site ──────────────────────────────────────
function officeWeekly() {
  const p = proj(HOME);
  const dow = (d(TODAY).getUTCDay() + 6) % 7, mon = addDays(TODAY, -dow - 7), sun = addDays(mon, 6);
  const days = Array.from({ length: 7 }, (_, k) => addDays(mon, k));
  const inWeek = (s) => s >= mon && s <= sun;
  const rs = reportsOf(HOME).filter((r) => inWeek(r.date));
  const cards = rs.flatMap((r) => r.cards.map((c) => ({ ...c, r })));
  const engineers = [...new Set(rs.map((r) => r.author))];
  const raised = issuesOf(HOME).filter((i) => inWeek(londonDay(i.raisedAt)));
  const closed = issuesOf(HOME).filter((i) => i.events.some((e) => e.kind === 'verified' && inWeek(londonDay(e.at))));
  const vars = D.variations.filter((v) => v.projectId === HOME && inWeek(londonDay(v.raisedAt)));
  const instructed = vars.filter((v) => v.instruction === 'instructed');
  const value = instructed.reduce((n, v) => n + (v.value || 0), 0);
  const visitDays = new Set(rs.map((r) => r.date)).size;
  const highlights = cards.filter((c) => c.photos && c.type === 'update').filter((c, k, a) => a.findIndex((x) => x.location === c.location) === k);
  highlights.splice(highlights.length >= 9 ? 9 : 5);
  const places = Object.entries(cards.filter((c) => c.type === 'update').reduce((m, c) => ((m[c.location] ||= []).push(c), m), {})).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const notes = D.notes.filter((n) => n.projectId === HOME).filter((n, k, a) => a.findIndex((x) => x.text === n.text) === k).slice(0, 3);
  const openLate = issuesOf(HOME).filter(isOverdue).length;
  return `${officeTop('Week')}<main class="o-wrap"><div class="wk">
    <div class="wk-bar"><div class="toggle"><span>‹ Week before</span><span class="on">Last week</span><span>This week so far</span></div><div class="toggle"><span class="on">Week</span><span>Month</span></div><div class="r"><a class="btn">Download PDF</a><a class="btn gold">Send to ${esc(p.pm)}</a></div></div>
    <section class="card wk-hero">
      <div class="eyebrow">Leodis Developments · the week at</div>
      <h1>${esc(p.name)}</h1>
      <div class="dates">${fmtDay(mon)} to ${fmtDay(sun)} 2026 · <span class="ref">${p.number}</span> · ${esc(p.client)}</div>
      <p class="wk-lead">${listNames(engineers.map((n) => `<b>${esc(n)}</b>`))} were on site on <b>${plural(visitDays, 'day')}</b> and sent <b>${plural(rs.length, 'site update')}</b>. They found <b>${plural(raised.length, 'issue')}</b>${closed.length ? ` and <b>${plural(closed.length, 'issue')}</b> ${closed.length === 1 ? 'was' : 'were'} checked and closed` : ', and none were closed this week'}. <b>${plural(vars.length, 'variation')}</b> came up, ${instructed.length ? `${instructed.length} instructed` : 'none instructed yet'}${value ? ` worth <b>£${value.toLocaleString('en-GB')}</b>` : ''}.</p>
      <div class="wk-days">${days.map((day) => { const dr = rs.filter((r) => r.date === day); const who = [...new Set(dr.map((r) => r.author))]; return `<div class="wk-day ${dr.length ? '' : 'off'}"><h4>${d(day).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}<span>${d(day).getUTCDate()}</span></h4>${dr.length ? `<div class="who">${who.map((n) => av(n, 'sm')).join('')}</div><small>${plural(dr.length, 'update')} · ${dr.reduce((n, r) => n + r.cards.length, 0)} cards</small>` : '<small>Nobody on site</small>'}</div>`; }).join('')}</div>
    </section>
    <div class="wk-nums">
      <div class="card"><b>${rs.length}</b><span>Site updates</span><small>over ${plural(visitDays, 'day')}</small></div>
      <div class="card"><b>${engineers.length}</b><span>Engineers</span><small>${[...new Set(rs.map((r) => r.trade))].join(', ')}</small></div>
      <div class="card"><b>${raised.length} <span class="muted" style="font-size:18px">/ ${closed.length}</span></b><span>Issues found / closed</span><small>${figures(HOME).open} open now · ${openLate} late</small></div>
      <div class="card"><b>${vars.length}</b><span>Variations</span><small>${instructed.length} instructed this week</small></div>
    </div>
    <h2>Photos from the week</h2>
    <div class="wk-photos">${highlights.map((c, k) => photo(c.location, { cap: `${c.location} · ${fmtDay(c.r.date)}`, seed: k })).join('')}</div>
    <h2>What got done, place by place</h2>
    <div class="wk-places">${places.map(([loc, list]) => `<div class="card wk-place"><h3><span class="chip place" style="--h:${hue(loc)}">${esc(loc)}</span></h3><ul>${list.slice(0, 3).map((c) => `<li>${av(c.r.author, 'sm', c.r.trade)}<span>${esc(c.text)} <small>· ${fmtDay(c.r.date)}</small></span></li>`).join('')}</ul></div>`).join('')}</div>
    <div class="wk-two">
      <div><h2>Issues found</h2><div class="card wk-list"><h3>This week <span>${raised.length}</span></h3>${raised.slice(0, 6).map((i) => `<div class="row"><b>${esc(i.text)}</b><span class="s">${issueState(i)}</span><small><span class="ref">${i.ref}</span> · ${esc(i.location)} · ${esc(i.owner || 'nobody yet')}</small></div>`).join('')}${raised.length > 6 ? `<div class="row"><small>${raised.length - 6} more in the register</small></div>` : ''}</div></div>
      <div><h2>Variations</h2><div class="card wk-list"><h3>Came up this week <span>${vars.length}</span></h3>${vars.slice(0, 6).map((v) => `<div class="row"><b>${esc(v.text)}</b><span class="s"><span class="pill ${v.instruction === 'pending' ? 'amber' : v.instruction === 'instructed' ? 'green' : 'grey'}">${v.instruction === 'pending' ? 'To price' : v.instruction === 'instructed' ? `£${(v.value || 0).toLocaleString('en-GB')}` : 'Declined'}</span></span><small><span class="ref">${v.ref}</span> · ${esc(v.location)} · ${esc(v.trade)}</small></div>`).join('')}</div></div>
    </div>
    <h2>For next week</h2>
    <div class="card wk-next">${notes.map((n) => `<p>${av(n.by, 'sm')}<span>${esc(n.text)} <span class="muted">· ${esc(n.by)}, ${fmtDay(londonDay(n.at))}</span></span></p>`).join('')}<p><span class="pill red">${openLate} late</span><span>issues are past their fix date at this site; the oldest go first on Monday.</span></p></div>
  </div></main>`;
}

// ── Router ──────────────────────────────────────────────────────────
const ROUTES = { 'eng-home': engHome, 'eng-update': engUpdate, 'eng-issue': engIssue, 'office-home': officeHome, 'office-issues': officeIssues, 'office-report': officeReport, 'office-weekly': officeWeekly };
function render() {
  const id = location.hash.slice(1) || 'eng-home';
  document.getElementById('app').innerHTML = (ROUTES[id] || engHome)();
  document.body.dataset.screen = id;
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
render();
})();
