/* Concept C: Control board. Renders every screen from window.RELAY_DATA. */
(() => {
const D = window.RELAY_DATA;
const TODAY = D.today;
const ME = D.people.engineer, HERE = 'proj-011lme';
const P = Object.fromEntries(D.projects.map(p => [p.id, p]));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ymd = d => d.toISOString().slice(0, 10);
const dt = s => new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
const addDays = (s, n) => { const d = dt(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fDay = s => { const d = dt(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const fShort = s => { const d = dt(s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const fTime = s => s ? new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : '';
const dayOf = s => new Date(s).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const money = n => '£' + Math.round(n).toLocaleString('en-GB');
const weekStart = s => { const d = dt(s); const k = (d.getUTCDay() + 6) % 7; return addDays(s, -k); };
const workingDays = (end, n) => { const out = []; let d = end; while (out.length < n) { const w = dt(d).getUTCDay(); if (w && w !== 6) out.unshift(d); d = addDays(d, -1); } return out; };
const TRADE = { Electrical: ['el', 'E'], HVAC: ['hv', 'H'], 'P&H': ['ph', 'P'] };
const tradeChip = t => { const [k, l] = TRADE[t] || ['el', '?']; return `<span class="trade trade-${k}" title="${esc(t)}">${l}</span>`; };

// Issue state
const isOpen = i => i.work !== 'closed' && i.confirmation !== 'withdrawn';
const isLate = i => isOpen(i) && i.work !== 'awaiting_verification' && i.target && i.target < TODAY;
const closedAt = i => (i.events.filter(e => e.kind === 'verified').at(-1) || {}).at;
const lastEv = i => i.events.at(-1);
const KIND = { update: ['Progress', 'grey'], defect: ['Defect', 'red'], instruction: ['Variation', 'amber'], access: ['Access', 'blue'] };
const KIND_ALL = { ...KIND, variation: ['Variation', 'amber'], check: ['Check', 'grey'] };
const kindBlock = k => { const [l, c] = KIND_ALL[k] || [k, 'grey']; return `<span class="st st-${c}">${l}</span>`; };
const workBlock = i => {
  if (i.work === 'closed') return '<span class="st st-green">Closed</span>';
  if (i.work === 'awaiting_verification') return '<span class="st st-amber">Fixed, to check</span>';
  if (isLate(i)) return `<span class="st st-red">${daysBetween(i.target, TODAY)}d late</span>`;
  if (i.work === 'in_progress') return '<span class="st st-blue">In progress</span>';
  if (i.work === 'assigned') return '<span class="st st-grey">Assigned</span>';
  return '<span class="st st-grey">New</span>';
};

// Icons
const I = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  ret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  cols: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/></svg>',
  pound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 6.5A4 4 0 0 0 9 9v11M6 13h7M6 20h12"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h14v13l-5 5H5z"/><path d="M14 21v-5h5"/></svg>',
  arrow: '→',
};
const CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const photoTile = n => `<span class="ph">${I.cam}${n > 1 ? `<b>${n}</b>` : ''}</span>`;

// ---------------- Engineer ----------------
const hereIssues = D.issues.filter(i => i.projectId === HERE && isOpen(i));
const sentBack = D.issues.filter(i => i.sentBack);
const engTop = (inner) => `<header class="e-top">${inner}</header>`;
const engNav = cur => `<nav class="e-nav" aria-label="Site">${[['home', 'Site', I.home], ['issues', 'Issues', I.warn], ['reports', 'Reports', I.doc], ['search', 'Search', I.search]].map(([k, l, ic]) => `<button ${k === cur ? 'aria-current="page"' : ''}>${ic}${l}</button>`).join('')}</nav>`;

function engHome() {
  const p = P[HERE];
  const note = D.notes.find(n => n.projectId === HERE);
  return `<div class="eng">${engTop(`
    <div class="e-top-row"><span class="e-brand">RELAY</span><span class="e-who">${esc(ME.name)} · ${fDay(TODAY)}</span></div>
    <div class="e-project"><div><h1>${esc(p.name)}</h1><p><span class="mono">${p.number}</span> · ${esc(p.pm)}, project manager</p></div><button class="e-switch">Switch</button></div>`)}
    <main class="e-main">
      <a class="big-tile" href="#eng-update"><span class="bt-ico">${I.pen}</span><span><strong>Today's update</strong><small>${D.draft.cards.length} cards · saved 13:32</small></span><span class="arrow">${I.arrow}</span></a>
      <div class="tiles">
        <button class="tile"><span class="t-ico ico-red">${I.warn}</span><span><strong>Defect</strong><small>Photo and a line, straight to the office</small></span></button>
        <button class="tile"><span class="t-ico ico-amber">${I.pound}</span><span><strong>Variation</strong><small>Extra work for the office to price</small></span></button>
        <button class="tile"><span class="count">${hereIssues.length}</span><span class="t-ico ico-dark">${I.pin}</span><span><strong>Issues here</strong><small>${hereIssues.filter(isLate).length} past their date</small></span></button>
        <button class="tile alert"><span class="count">${sentBack.length}</span><span class="t-ico ico-red">${I.ret}</span><span><strong>Sent back to you</strong><small>The office needs more</small></span></button>
      </div>
      <div class="e-sec"><h2>Sent back to you</h2><span>${sentBack.length}</span></div>
      ${sentBack.map(i => { const e = lastEv(i); return `<a class="back-card" href="#eng-issue">
        <div class="bc-top"><span class="ref">${i.ref.replace(/^\w+-/, '')}</span><span>${esc(i.location)}</span></div>
        <h3>${esc(i.text)}</h3>
        <p class="said"><b>${esc(e.who)}, ${fDay(dayOf(e.at))} ${fTime(e.at)}</b>${esc(e.note)}</p>
        <span class="bc-go">Open and answer ${I.arrow}</span></a>`; }).join('')}
      ${note ? `<div class="note-strip">${I.note}<div>${esc(note.text)}<small>Note for the next visit · ${esc(note.by)}, ${fDay(dayOf(note.at))}</small></div></div>` : ''}
    </main>${engNav('home')}</div>`;
}

function engUpdate() {
  const d = D.draft; const c0 = d.cards[0];
  const recent = [...new Set(D.reports.filter(r => r.projectId === HERE).flatMap(r => r.cards.map(c => c.location)))].slice(0, 5);
  return `<div class="eng">${engTop(`
    <div class="e-top-row"><button class="e-back">${I.back} Site</button><span class="e-who mono">${d.ref}</span></div>
    <div class="e-project"><div><h1>Today's update</h1><p>${esc(P[HERE].name)} · ${fDay(TODAY)}</p></div></div>
    <div class="e-steps-head"><span class="pill on">1 · Cards</span><span class="pill">2 · Check &amp; send</span><span class="saved">Saved on this phone</span></div>`)}
    <main class="e-main">
      <section class="card-blk open">
        <div class="cb-head"><span class="cb-no">01</span><strong>${esc(c0.location)}</strong>${kindBlock(c0.type)}</div>
        <div class="stepper">
          <div class="step"><span class="sn">${CHECK}</span><div><h4>Where</h4><div class="chips">${recent.slice(0, 4).map(l => `<button class="chip ${l === c0.location ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div></div>
          <div class="step"><span class="sn">${CHECK}</span><div><h4>What happened</h4><div class="field-box">${esc(c0.text)}</div></div></div>
          <div class="step now"><span class="sn">3</span><div><h4>Photos <small>${c0.photos} taken</small></h4><div class="photo-row">${Array.from({ length: Math.min(c0.photos, 2) }, () => photoTile(1)).join('')}<button class="add-photo">${I.cam}Add photo</button></div></div></div>
          <div class="step todo"><span class="sn">4</span><div><h4>What kind</h4><div class="type-grid">${Object.entries(KIND).map(([k, [l, c]]) => `<button class="type-btn ${k === c0.type ? 'on' : ''}"><i style="background:var(--${c === 'grey' ? 'line-2' : c})"></i>${l}</button>`).join('')}</div></div></div>
        </div>
      </section>
      ${d.cards.slice(1).map((c, n) => `<section class="card-blk">
        <div class="cb-head"><span class="cb-no">0${n + 2}</span><strong>${esc(c.location)}</strong>${kindBlock(c.type)}</div>
        <div class="cb-body">${esc(c.text)}</div>
        <div class="cb-photos">${Array.from({ length: c.photos }, () => photoTile(1)).join('')}<button class="add-photo" style="font-size:12px">${I.cam}Add</button></div></section>`).join('')}
      <div class="e-sec"><h2>Add a card</h2></div>
      <div class="add-card">${Object.entries(KIND).map(([, [l]]) => `<button><span>+</span>${l}</button>`).join('')}</div>
      <div style="height:40px"></div>
    </main>
    <div class="send-bar"><div class="sb-meta"><span><b>${d.cards.length} cards</b> · ${d.cards.reduce((a, c) => a + c.photos, 0)} photos</span><span>Sends when there is signal</span></div><button>Check &amp; send ${I.arrow}</button></div></div>`;
}

function engIssue() {
  const i = sentBack[0];
  const e = lastEv(i);
  const steps = ['Raised', 'Confirmed', 'Assigned', 'Fixed', 'Checked'];
  const at = { open: 0, assigned: 2, in_progress: 2, awaiting_verification: 3, closed: 4 }[i.work] ?? 0;
  const late = i.target && i.target < TODAY;
  return `<div class="eng">${engTop(`
    <div class="e-top-row"><button class="e-back">${I.back} Site</button><span class="e-who mono">${i.ref}</span></div>
    <h1 class="i-title">${esc(i.text)}</h1>
    <div class="track">${steps.map((s, n) => `<div class="${n < at + 1 ? 'done' : ''} ${n === at + 1 ? 'now' : ''}"><i></i>${s}</div>`).join('')}</div>`)}
    <main class="e-main">
      <div class="sentback"><b>Sent back by the office · ${fDay(dayOf(e.at))}, ${fTime(e.at)}</b><p>${esc(e.note)}</p><small>${esc(e.who)}</small></div>
      <dl class="facts" style="margin:0">
        <div><dt>Where</dt><dd>${esc(i.location)}</dd></div>
        <div><dt>What needs doing</dt><dd>${esc(i.action)}</dd></div>
        <div><dt>Who is fixing it</dt><dd>${esc(i.owner)}</dd></div>
        <div><dt>Due</dt><dd class="${late ? 'late' : ''}">${fDay(i.target)}${late ? ` · ${daysBetween(i.target, TODAY)} days late` : ''}</dd></div>
      </dl>
      <div class="e-sec"><h2>History</h2><span>${i.events.length}</span></div>
      <div class="hist"><ul>${[...i.events].reverse().map(ev => `<li><time>${fShort(dayOf(ev.at))}</time><div><b>${esc(ev.who)}</b> ${({ raised: 'raised it', confirmation: 'confirmed it', assigned: 'assigned it', progress: 'added progress', closure_submitted: 'put it forward as fixed', reopened: 'sent it back', verified: 'checked and closed it' })[ev.kind] || ev.kind}${ev.note ? `<br><span>${esc(ev.note)}</span>` : ''}</div></li>`).join('')}</ul></div>
      <div style="height:60px"></div>
    </main>
    <div class="fix-bar"><button class="fb-photo" aria-label="Add photo">${I.cam}</button><button class="fb-go">Mark fixed</button></div></div>`;
}

// ---------------- Office ----------------
const open = D.issues.filter(isOpen);
const toCheck = open.filter(i => i.work === 'awaiting_verification');
const late = open.filter(isLate);
const unassigned = open.filter(i => !i.owner && i.work !== 'awaiting_verification');
const unseen = D.reports.filter(r => !r.seen);
const varWaiting = D.variations.filter(v => v.instruction === 'pending');
const sideNav = cur => `<aside class="side">
  <div class="brand"><b>RELAY</b><small>Leodis Developments · office</small></div>
  <nav>${[['office-home', 'Overview', I.grid, ''], ['office-issues', 'Issues', I.cols, `<span class="n red">${late.length}</span>`], ['office-report', 'Reports', I.doc, `<span class="n">${unseen.length}</span>`], ['', 'Variations', I.pound, `<span class="n">${varWaiting.length}</span>`], ['office-weekly', 'Weekly', I.chart, ''], ['', 'Team', I.team, '']].map(([h, l, ic, n]) => `<a href="#${h}" ${h === cur ? 'aria-current="page"' : ''}>${ic}${l}${n}</a>`).join('')}</nav>
  <div class="grp">Projects</div>
  <nav>${D.projects.map(p => `<a href="#office-home"><span class="mono" style="font-size:12px;color:var(--gold)">${p.number}</span>${esc(p.name.split(' - ')[0])}</a>`).join('')}</nav>
  <div class="me"><i>OM</i><div>Office Manager<small>Manager</small></div></div></aside>`;
const officeShell = (cur, title, sub, body, tools = '') => `<div class="office">${sideNav(cur)}<div class="o-main">
  <header class="o-head"><h1>${title}</h1><span class="sub">${sub}</span>${tools}<div class="search">${I.search}Search reports, issues, places, people<kbd>/</kbd></div></header>
  <main class="o-body">${body}</main></div></div>`;

function officeHome() {
  const today = D.reports.filter(r => r.date === TODAY);
  const days = workingDays(TODAY, 10);
  const vInstructed = D.variations.filter(v => v.instruction === 'instructed' && v.value && (v.raisedAt || '') >= addDays(TODAY, -30));
  const kpis = [
    ['Reports today', today.length, `${new Set(today.map(r => r.author)).size} engineers on site`, 'gold'],
    ['Not read yet', unseen.length, 'reports nobody in the office opened', 'amber'],
    ['Fixes to check', toCheck.length, `oldest ${Math.max(...toCheck.map(i => daysBetween(dayOf(lastEv(i).at), TODAY)))} days`, 'amber'],
    ['Issues overdue', late.length, `of ${open.length} open`, 'red'],
    ['No one assigned', unassigned.length, 'open issues without an owner', 'red'],
    ['Variations waiting', varWaiting.length, `${varWaiting.filter(v => v.workDone).length} done, not instructed`, 'blue'],
  ];
  const rows = D.projects.map(p => {
    const rs = D.reports.filter(r => r.projectId === p.id);
    const po = open.filter(i => i.projectId === p.id);
    const last = rs[0];
    return `<tr><th scope="row"><a href="#office-report">${esc(p.name)}</a><small><span class="mono">${p.number}</span> · ${esc(p.status)} · last visit ${last ? (last.date === TODAY ? 'today' : fDay(last.date)) : 'none'}</small></th>
      ${days.map((d, n) => { const tr = [...new Set(rs.filter(r => r.date === d).map(r => r.trade))].sort(); return `<td class="${d === TODAY ? 'today' : ''} ${n && dt(d).getUTCDay() === 1 ? 'wk' : ''}"><span class="cell">${tr.length ? tr.map(tradeChip).join('') : '<span class="empty"></span>'}</span></td>`; }).join('')}
      <td class="figs"><div class="figs-row"><div>Open<b>${po.length}</b></div><div>Late<b class="red">${po.filter(isLate).length}</b></div><div>Check<b>${po.filter(i => i.work === 'awaiting_verification').length}</b></div></div></td></tr>`;
  }).join('');
  const act = [
    ...toCheck.sort((a, b) => lastEv(a).at.localeCompare(lastEv(b).at)).slice(0, 3).map(i => ['<span class="st st-amber">Check fix</span>', `${i.ref.replace(/^\w+-/, '')} · ${i.location}`, `${P[i.projectId].name} · put forward by ${lastEv(i).who}, ${daysBetween(dayOf(lastEv(i).at), TODAY)} days ago`, 'Verify']),
    ...unassigned.slice(0, 2).map(i => ['<span class="st st-red">Assign</span>', `${i.ref.replace(/^\w+-/, '')} · ${i.location}`, `${P[i.projectId].name} · ${i.trade} · raised ${fShort(dayOf(i.raisedAt))}`, 'Assign']),
    ...varWaiting.filter(v => v.workDone).slice(0, 2).map(v => ['<span class="st st-blue">Instruct</span>', `${v.ref.replace(/^\w+-/, '')} · ${v.location}`, `${P[v.projectId].name} · work done, ${v.reason.toLowerCase()}`, 'Open']),
  ];
  const feed = D.reports.slice(0, 7);
  const body = `
    <dl class="kpis" style="margin:0">${kpis.map(([l, v, s, c]) => `<div class="kpi ${c}"><dt>${l}</dt><dd class="${c === 'red' ? 'red' : ''}">${v}</dd><small>${s}</small></div>`).join('')}</dl>
    <section class="panel"><div class="bar"><h2>Who was on site</h2><span class="meta">last 10 working days, by trade</span><div class="right legend"><span>${tradeChip('Electrical')} Electrical</span><span>${tradeChip('HVAC')} HVAC</span><span>${tradeChip('P&H')} P&amp;H</span></div></div>
      <table class="matrix"><thead><tr><th>Project</th>${days.map(d => `<th class="${d === TODAY ? 'today' : ''}">${DAYS[dt(d).getUTCDay()]}<b>${dt(d).getUTCDate()}</b></th>`).join('')}<th style="text-align:left;padding-left:14px">Issues now</th></tr></thead><tbody>${rows}</tbody></table></section>
    <div class="cols-2">
      <section class="panel act"><div class="bar"><h2>Act now</h2><span class="meta">oldest first</span><div class="right"><a class="more" href="#office-issues">Open the board ${I.arrow}</a></div></div>
        <ul>${act.map(([s, t, m, b]) => `<li>${s}<div><b>${esc(t)}</b><small>${esc(m)}</small></div><button class="btn">${b}</button></li>`).join('')}</ul></section>
      <section class="panel feed"><div class="bar"><h2>Coming in</h2><span class="meta">today</span><div class="right"><a class="more" href="#office-report">All reports ${I.arrow}</a></div></div>
        <ul>${feed.map(r => `<li><time>${fTime(r.at)}</time>${tradeChip(r.trade)}<div><b>${esc(r.author)}</b> · ${esc(P[r.projectId].name.split(' - ')[0])}<small>${r.cards.length} cards · ${r.cards.filter(c => c.type === 'defect').length} defects · <span class="ref">${r.ref}</span></small></div>${r.seen ? '' : '<span class="dot-new" title="Not read yet"></span>'}</li>`).join('')}</ul></section>
    </div>`;
  return officeShell('office-home', 'Overview', `${fDay(TODAY)} · updated ${fTime(new Date().toISOString())}`, body);
}

let issueProject = 'all';
function officeIssues() {
  const pool = D.issues.filter(i => issueProject === 'all' || i.projectId === issueProject);
  const weekAgo = addDays(TODAY, -7);
  const cols = [
    ['col-new', 'New', 'to confirm', pool.filter(i => isOpen(i) && (i.work === 'open' || i.confirmation === 'provisional') && i.work !== 'awaiting_verification')],
    ['col-ass', 'Assigned', 'not started', pool.filter(i => isOpen(i) && i.work === 'assigned' && i.confirmation !== 'provisional')],
    ['col-prog', 'In progress', 'trade on it', pool.filter(i => isOpen(i) && i.work === 'in_progress' && i.confirmation !== 'provisional')],
    ['col-check', 'Fixed, to check', 'your move', pool.filter(i => i.work === 'awaiting_verification' && i.confirmation !== 'withdrawn')],
    ['col-done', 'Closed', 'last 30 days', pool.filter(i => i.work === 'closed' && (closedAt(i) || '') >= addDays(TODAY, -30))],
  ];
  const sortKey = i => isLate(i) ? -daysBetween(i.target, TODAY) : (i.target ? daysBetween(TODAY, i.target) : 999);
  const card = (i, col) => {
    const lt = isLate(i);
    const age = col === 'col-check' ? `${daysBetween(dayOf(lastEv(i).at), TODAY)}d waiting` : col === 'col-done' ? fShort(dayOf(closedAt(i))) : lt ? `${daysBetween(i.target, TODAY)}d late` : i.target ? `due ${fShort(i.target)}` : `${daysBetween(dayOf(i.raisedAt), TODAY)}d old`;
    return `<article class="kcard ${lt ? 'late' : ''}"><div class="k-top">${tradeChip(i.trade)}<span class="ref">${i.ref.replace(/-ISS-/, ' · ')}</span><span class="age ${lt ? 'red' : ''}">${age}</span></div>
      <p>${esc(i.text)}</p><div class="k-foot"><span class="own ${i.owner ? '' : 'none'}">${esc(i.owner || 'No one assigned')}</span>·<span>${esc(i.location)}</span></div></article>`;
  };
  const tools = `<div class="toolbar" style="margin-left:8px"><div class="seg" role="group" aria-label="View"><button aria-pressed="true">Board</button><button aria-pressed="false">Table</button></div></div>`;
  const body = `
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Project">${[['all', 'All projects'], ...D.projects.map(p => [p.id, p.name.split(' - ')[0]])].map(([id, l]) => `<button data-proj="${id}" aria-pressed="${issueProject === id}">${esc(l)}</button>`).join('')}</div>
      <span class="sel">Trade <b>All</b></span><span class="sel">Company <b>Anyone</b></span><span class="sel">Place <b>Anywhere</b></span>
      <span class="sp"></span><button class="btn">${I.dl}Spreadsheet</button><button class="btn dark">Snag list</button>
    </div>
    <div class="kanban">${cols.map(([cls, name, hint, list]) => {
      const lateN = list.filter(isLate).length, noOwner = list.filter(i => !i.owner).length;
      const shown = [...list].sort(cls === 'col-done' ? (a, b) => (closedAt(b) || '').localeCompare(closedAt(a) || '') : cls === 'col-check' ? (a, b) => lastEv(a).at.localeCompare(lastEv(b).at) : (a, b) => sortKey(a) - sortKey(b)).slice(0, 6);
      return `<section class="col ${cls}"><header class="col-h">${name}${hint ? `<small>· ${hint}</small>` : ''}<span class="n">${list.length}</span></header>
        <div class="col-sum">${cls === 'col-done' ? `<span>verified by the office</span>` : cls === 'col-check' ? `<span>oldest <b>${list.length ? Math.max(...list.map(i => daysBetween(dayOf(lastEv(i).at), TODAY))) : 0}</b> days waiting</span>` : `<span><b class="red">${lateN}</b> late</span>·<span><b>${noOwner}</b> no owner</span>`}</div>
        <div class="col-b">${shown.map(i => card(i, cls)).join('')}${list.length > shown.length ? `<div class="col-more">+ ${list.length - shown.length} more</div>` : ''}</div></section>`;
    }).join('')}</div>`;
  return officeShell('office-issues', 'Issues', `${open.length} open · ${late.length} overdue · ${toCheck.length} fixed, to check`, body, tools);
}

function linkedFor(r) {
  const day = r.date;
  return r.cards.map(c => {
    if (c.type === 'defect' || c.type === 'access') { const i = D.issues.find(i => i.projectId === r.projectId && dayOf(i.raisedAt) === day && i.location === c.location); return i ? ['issue', i] : null; }
    if (c.type === 'instruction' || c.type === 'variation') { const v = D.variations.find(v => v.projectId === r.projectId && dayOf(v.raisedAt) === day && v.location === c.location); return v ? ['var', v] : null; }
    return null;
  });
}
function officeReport() {
  const list = D.reports.slice(0, 14);
  const r = D.reports.find(x => x.cards.length >= 5 && x.cards.some(c => c.type === 'defect')) || D.reports[0];
  const prev = D.reports.find(x => x.projectId === r.projectId && x.author === r.author && x.date < r.date);
  const links = linkedFor(r);
  let lastDay = '';
  const items = list.map(x => { const head = x.date !== lastDay ? `<li class="day" style="display:block">${x.date === TODAY ? 'Today' : fDay(x.date)}</li>` : ''; lastDay = x.date; return head + `<li class="${x === r ? 'is-sel' : ''}">${x.seen ? '<span></span>' : '<span class="dot-new" title="Not read yet"></span>'}<div><b>${esc(P[x.projectId].name)}</b><small>${esc(x.author)} · ${x.trade} · <span class="ref">${x.ref}</span></small></div><div class="r-side">${fTime(x.at)}<div class="mini">${x.cards.map(c => `<i style="background:var(--${({ defect: 'red', instruction: 'amber', access: 'blue' })[c.type] || 'line-2'})"></i>`).join('')}</div></div></li>`; }).join('');
  const counts = Object.entries(KIND).map(([k, [l, c]]) => [l, c, r.cards.filter(x => x.type === k).length]).filter(x => x[2]);
  const tools = `<div class="toolbar" style="margin-left:8px"><div class="seg" role="group" aria-label="Show"><button aria-pressed="true">All · ${D.reports.length}</button><button aria-pressed="false">Not read · ${unseen.length}</button><button aria-pressed="false">With defects</button></div></div>`;
  const body = `<div class="split">
    <section class="panel rlist"><div class="bar"><h2>Reports</h2><span class="meta">newest first</span><div class="right"><span>Project: all</span></div></div><ul>${items}</ul></section>
    <section class="panel">
      <div class="rhead"><div><div class="crumbs">${esc(P[r.projectId].name)} · Site update · <span class="ref">${r.ref}</span> · rev ${r.revision}</div><h2>${esc(r.author)}, ${r.trade} · ${fDay(r.date)}</h2>
        <div class="crumbs">Received ${fTime(r.at)}${prev ? ` · previous ${r.trade} visit ${fDay(prev.date)} (<span class="ref">${prev.ref}</span>)` : ''}</div></div>
        <div class="acts"><button class="btn">${I.eye}Full report</button><button class="btn">${I.dl}PDF</button><button class="btn dark">Mark read</button></div></div>
      <div class="stages"><div>Received<span class="st st-green">On file</span></div><div>PDF<span class="st st-green">Ready</span></div><div>Filed to SharePoint<span class="st st-grey">Waiting to send</span></div><div>Seen by the office<span class="st ${r.seen ? 'st-green' : 'st-amber'}">${r.seen ? 'Seen' : 'Not yet'}</span></div></div>
      <div class="rsum">${counts.map(([l, c, n]) => `<span class="st st-${c}">${n} ${l.toLowerCase()}${n > 1 && l !== 'Progress' && l !== 'Access' ? 's' : ''}</span>`).join('')}<span>· ${r.cards.reduce((a, c) => a + c.photos, 0)} photos · ${links.filter(Boolean).length} records raised</span></div>
      <div class="rcards">${r.cards.map((c, n) => { const l = links[n]; return `<article class="rcard"><div class="rc-h"><span class="no">${String(n + 1).padStart(2, '0')}</span><b>${esc(c.location)}</b>${kindBlock(c.type)}</div>
        <div class="rc-b"><div><p>${esc(c.text)}</p>${c.action ? `<p class="need"><b>Needs:</b> ${esc(c.action)}${c.owner ? ` · <b>${esc(c.owner)}</b>` : ''}</p>` : ''}</div><div class="rc-ph">${c.photos ? Array.from({ length: Math.min(c.photos, 2) }, (_, k) => photoTile(k === 1 && c.photos > 2 ? c.photos : 1)).join('') : '<span style="font-size:12px;color:var(--text-3)">No photos</span>'}</div></div>
        ${l ? `<div class="rc-link">${l[0] === 'issue' ? 'Issue' : 'Variation'} <span class="ref">${l[1].ref}</span>${l[0] === 'issue' ? workBlock(l[1]) : `<span class="st st-${l[1].instruction === 'instructed' ? 'green' : 'blue'}">${l[1].instruction === 'instructed' ? 'Instructed' : 'Waiting'}</span>`}<span class="go">Open ${I.arrow}</span></div>` : '<div></div>'}</article>`; }).join('')}</div>
    </section></div>`;
  return officeShell('office-report', 'Reports', `${D.reports.length} in the last six weeks · ${unseen.length} not read`, body, tools);
}

function officeWeekly() {
  const pid = HERE, p = P[pid];
  const ws = weekStart(TODAY), we = addDays(ws, 6);
  const issues = D.issues.filter(i => i.projectId === pid);
  const reports = D.reports.filter(r => r.projectId === pid);
  // Six weeks of raised vs closed.
  const weeks = Array.from({ length: 6 }, (_, k) => addDays(ws, -7 * (5 - k)));
  const raisedIn = (a, b) => issues.filter(i => { const d = dayOf(i.raisedAt); return d >= a && d < b; }).length;
  const closedIn = (a, b) => issues.filter(i => { const c = closedAt(i); return c && dayOf(c) >= a && dayOf(c) < b; }).length;
  const openAt = d => issues.filter(i => dayOf(i.raisedAt) < d && i.confirmation !== 'withdrawn' && !(closedAt(i) && dayOf(closedAt(i)) < d)).length;
  const lateAt = d => issues.filter(i => dayOf(i.raisedAt) < d && i.confirmation !== 'withdrawn' && i.target && i.target < d && !(closedAt(i) && dayOf(closedAt(i)) < d) && !(i.work === 'awaiting_verification' && dayOf(lastEv(i).at) < d)).length;
  const wk = weeks.map(w => ({ w, raised: raisedIn(w, addDays(w, 7)), closed: closedIn(w, addDays(w, 7)), late: lateAt(w === ws ? addDays(TODAY, 1) : addDays(w, 7)), open: openAt(w === ws ? addDays(TODAY, 1) : addDays(w, 7)) }));
  const thisWk = wk.at(-1);
  const wkReports = reports.filter(r => r.date >= ws && r.date <= we);
  const vWeek = D.variations.filter(v => v.projectId === pid && dayOf(v.raisedAt) >= ws);
  const vInstr = D.variations.filter(v => v.projectId === pid && v.instruction === 'instructed' && v.value);
  // Bars chart
  const W = 520, H = 210, padL = 30, padB = 26, padT = 10;
  const max = Math.max(4, ...wk.flatMap(x => [x.raised, x.closed]));
  const step = Math.ceil(max / 4); const top = step * 4;
  const y = v => padT + (H - padT - padB) * (1 - v / top);
  const gw = (W - padL) / 6, bw = 22;
  const bars = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Issues raised and closed by week">
    <g class="grid">${[0, 1, 2, 3, 4].map(k => `<line x1="${padL}" x2="${W}" y1="${y(k * step)}" y2="${y(k * step)}"/><text x="${padL - 6}" y="${y(k * step) + 4}" text-anchor="end">${k * step}</text>`).join('')}</g>
    ${wk.map((x, k) => { const cx = padL + gw * k + gw / 2; return `<rect x="${cx - bw - 2}" y="${y(x.raised)}" width="${bw}" height="${y(0) - y(x.raised)}" fill="var(--red)" rx="2"/><rect x="${cx + 2}" y="${y(x.closed)}" width="${bw}" height="${y(0) - y(x.closed)}" fill="var(--green)" rx="2"/>
      <text x="${cx - bw / 2 - 2}" y="${y(x.raised) - 4}" text-anchor="middle" class="lbl-strong">${x.raised}</text><text x="${cx + bw / 2 + 2}" y="${y(x.closed) - 4}" text-anchor="middle" class="lbl-strong">${x.closed}</text>
      <text x="${cx}" y="${H - 8}" text-anchor="middle" ${k === 5 ? 'class="lbl-strong"' : ''}>${k === 5 ? 'This wk' : fShort(x.w)}</text>`; }).join('')}</svg>`;
  // Overdue trend line
  const LW = 380, LH = 150, lp = 30, lb = 24;
  const lmax = Math.max(4, ...wk.map(x => x.late)); const lstep = Math.ceil(lmax / 3); const ltop = lstep * 3;
  const ly = v => 10 + (LH - 10 - lb) * (1 - v / ltop); const lx = k => lp + 14 + (LW - lp - 28) * k / 5;
  const line = `<svg viewBox="0 0 ${LW} ${LH}" width="100%" role="img" aria-label="Overdue issues at the end of each week">
    <g class="grid">${[0, 1, 2, 3].map(k => `<line x1="${lp}" x2="${LW}" y1="${ly(k * lstep)}" y2="${ly(k * lstep)}"/><text x="${lp - 6}" y="${ly(k * lstep) + 4}" text-anchor="end">${k * lstep}</text>`).join('')}</g>
    <path d="M${wk.map((x, k) => `${lx(k)},${ly(x.late)}`).join(' L')} L${lx(5)},${ly(0)} L${lx(0)},${ly(0)} Z" fill="var(--red-wash)"/>
    <polyline points="${wk.map((x, k) => `${lx(k)},${ly(x.late)}`).join(' ')}" fill="none" stroke="var(--red)" stroke-width="2.5"/>
    ${wk.map((x, k) => `<circle cx="${lx(k)}" cy="${ly(x.late)}" r="${k === 5 ? 5 : 3.5}" fill="var(--red)"/><text x="${lx(k)}" y="${LH - 6}" text-anchor="middle">${k === 5 ? 'Now' : fShort(x.w)}</text>`).join('')}
    <text x="${lx(5) - 10}" y="${ly(thisWk.late) + 4}" text-anchor="end" class="lbl-strong">${thisWk.late}</text></svg>`;
  // Heatmap: visits by trade per day, last two weeks
  const hdays = workingDays(addDays(ws, 4), 10);
  const trades = ['Electrical', 'HVAC', 'P&H'];
  const hcount = (t, d) => reports.filter(r => r.trade === t && r.date === d).length;
  const heat = `<table class="heat"><thead><tr><th></th>${hdays.map(d => `<th>${DAYS[dt(d).getUTCDay()].slice(0, 2)} ${dt(d).getUTCDate()}</th>`).join('')}</tr></thead><tbody>
    ${trades.map(t => `<tr><th style="text-align:left;font-size:12.5px;color:var(--text-2)">${t}</th>${hdays.map(d => { const n = hcount(t, d); const fut = d > TODAY; const col = `var(--t-${TRADE[t][0]})`; return `<td class="${n ? '' : 'h0'}" style="${n ? `background:color-mix(in srgb, ${col} ${Math.min(100, 45 + n * 30)}%, transparent);color:${t === 'Electrical' ? '#111214' : 'var(--panel)'}` : ''}${fut ? ';opacity:.4' : ''}">${fut ? '' : n || '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  // Top locations with open issues
  const locs = Object.entries(issues.filter(isOpen).reduce((m, i) => ((m[i.location] ||= { n: 0, late: 0 }), m[i.location].n++, isLate(i) && m[i.location].late++, m), {})).sort((a, b) => b[1].n - a[1].n).slice(0, 7);
  const lmaxN = Math.max(...locs.map(l => l[1].n));
  const kpis = [
    ['Site visits', wkReports.length, `${new Set(wkReports.map(r => r.author)).size} engineers`, 'gold'],
    ['Issues raised', thisWk.raised, 'this week', 'red'],
    ['Issues closed', thisWk.closed, 'verified this week', 'green'],
    ['Open now', thisWk.open, `${issues.filter(i => i.work === 'awaiting_verification').length} fixed, to check`, ''],
    ['Overdue now', thisWk.late, `${thisWk.late - wk.at(-2).late >= 0 ? '+' : ''}${thisWk.late - wk.at(-2).late} on last week`, 'red'],
    ['Variations raised', vWeek.length, `${vWeek.filter(v => v.workDone).length} with work done`, 'blue'],
  ];
  const tools = `<div class="toolbar" style="margin-left:8px"><div class="seg" role="group" aria-label="Period"><button aria-pressed="true">Week</button><button aria-pressed="false">Month</button></div></div>`;
  const body = `
    <div class="wk-head"><div class="title"><h2>${esc(p.name)}</h2><p><span class="mono">${p.number}</span> · ${esc(p.client)} · ${esc(p.pm)} · week of ${fDay(ws)} to ${fDay(we)}, so far</p></div>
      <span class="sp"></span><div class="seg" role="group" aria-label="Week"><button aria-pressed="false">‹ 19 Oct</button><button aria-pressed="true">This week</button></div><button class="btn">${I.eye}Client view</button><button class="btn dark">${I.dl}PDF for the client</button></div>
    <dl class="kpis" style="margin:0">${kpis.map(([l, v, s, c]) => `<div class="kpi ${c}"><dt>${l}</dt><dd class="${c === 'red' && l.startsWith('Overdue') ? 'red' : ''}">${v}</dd><small>${s}</small></div>`).join('')}</dl>
    <div class="grid-2">
      <section class="panel"><div class="bar"><h2>Issues raised and closed</h2><span class="meta">last six weeks</span></div><div class="chart">${bars}</div><div class="chart-key"><span><i style="background:var(--red)"></i>Raised</span><span><i style="background:var(--green)"></i>Closed</span></div></section>
      <section class="panel"><div class="bar"><h2>Overdue issues</h2><span class="meta">at the end of each week</span></div><div class="chart">${line}</div>
        <div class="vtotal" style="border-top:1px solid var(--line);border-bottom:0"><div>Raised this week<b>${thisWk.raised}</b></div><div>Closed<b>${thisWk.closed}</b></div><div>Net<b style="color:${thisWk.raised > thisWk.closed ? 'var(--red)' : 'var(--green)'}">${thisWk.raised - thisWk.closed > 0 ? '+' : ''}${thisWk.raised - thisWk.closed}</b></div></div></section>
    </div>
    <div class="grid-3">
      <section class="panel" style="grid-column:span 2"><div class="bar"><h2>Who was on site</h2><span class="meta">site updates by trade, last two weeks</span></div>${heat}</section>
      <section class="panel"><div class="bar"><h2>Variations</h2><span class="meta">this project</span></div>
        <div class="vtotal"><div>This week<b>${vWeek.length}</b></div><div>Waiting<b>${D.variations.filter(v => v.projectId === pid && v.instruction === 'pending').length}</b></div><div>Instructed<b>${money(vInstr.reduce((a, v) => a + v.value, 0))}</b></div></div>
        <div class="wlist"><ul>${vWeek.slice(0, 3).map(v => `<li><span class="ref">${v.ref.replace(/^\w+-/, '')}</span><div>${esc(v.location)}<small>${esc(v.raisedBy)} · ${esc(v.reason)}</small></div><span class="st st-${v.instruction === 'instructed' ? 'green' : v.instruction === 'declined' ? 'grey' : 'blue'}">${v.instruction === 'pending' ? 'Waiting' : v.instruction[0].toUpperCase() + v.instruction.slice(1)}</span></li>`).join('')}</ul></div></section>
    </div>
    <div class="grid-2">
      <section class="panel"><div class="bar"><h2>On site this week</h2><span class="meta">${wkReports.length} site updates</span></div><div class="wlist"><ul>${wkReports.slice(0, 6).map(r => `<li><time>${fDay(r.date).slice(0, 6)}</time><div><b>${esc(r.author)}</b> · ${r.trade} <span class="ref" style="color:var(--text-3)">${r.ref}</span><small>${r.cards.slice(0, 2).map(c => `${esc(c.location)}: ${esc(c.text.slice(0, 60))}…`).join('<br>')}</small></div><span style="display:flex;gap:4px">${r.cards.filter(c => c.type !== 'update').slice(0, 3).map(c => kindBlock(c.type)).join('')}</span></li>`).join('')}</ul></div></section>
      <section class="panel hbars"><div class="bar"><h2>Where the open issues are</h2><span class="meta">top places</span><div class="right legend"><span><i style="width:10px;height:10px;background:var(--red);display:inline-block;border-radius:2px"></i>late</span></div></div>
        <ul>${locs.map(([l, v]) => `<li><span>${esc(l)}</span><span class="track2"><i style="width:${v.late / lmaxN * 100}%;background:var(--red)"></i><i style="width:${(v.n - v.late) / lmaxN * 100}%;background:var(--text-3)"></i></span><b>${v.n}</b></li>`).join('')}</ul></section>
    </div>`;
  return officeShell('office-weekly', 'Weekly', 'one project, one week, at a glance', body, tools);
}

const ROUTES = { 'eng-home': engHome, 'eng-update': engUpdate, 'eng-issue': engIssue, 'office-home': officeHome, 'office-issues': officeIssues, 'office-report': officeReport, 'office-weekly': officeWeekly };
function render() {
  const r = ROUTES[location.hash.slice(1)] || engHome;
  document.getElementById('app').innerHTML = r();
  document.querySelectorAll('[data-proj]').forEach(b => b.addEventListener('click', () => { issueProject = b.dataset.proj; render(); }));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
render();
})();
