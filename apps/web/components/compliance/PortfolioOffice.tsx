'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  AS, BL, BUILDINGS, CATS, CAT_IDS, CL, CLIENTS, ENG, ENGINEERS, GR, RTYPES, TODAY, addDays, addMonths, assets, assign, attentionItems, book, buildingsOf,
  closeRemedial, dayDiff, dueItems, engName, engineersFor, eventById, events, eventsOf, fileReport, findings, fmt, fmtS, fromISO, groupRems, groups, groupsOfBuilding,
  groupsOfClient, intervalWord, lateItems, noneItems, notify, notifyAll, openRems, pathTo, plural, raiseRemedial, remedials, rollup, status, toISO, unbook, warrantyWatch,
  type Asset, type Building, type Client, type EngineerId, type Event, type Group, type Remedial,
} from '@/lib/compliance/model';
import { Bar, BarKey, DueCell, Meta, Modal, ResultTag, Tag, Toasts, formValues, parseHash, toast, useHashRoute, useModel, useMounted } from './shared';

type Dialog =
  | { kind: 'book'; g: Group; early?: boolean } | { kind: 'assign'; r: Remedial } | { kind: 'newreport'; g: Group; mode: 'file' | 'record' }
  | { kind: 'raise' } | { kind: 'report'; e: Event } | { kind: 'statement'; client?: string; building?: string } | { kind: 'hub' };
interface Route { tab: string; a: string | null; b: string | null; c: string | null }
const HOME = '#/portfolio/AVH/ARC/AVH-ARC-FA-01';

const ClientLine = ({ g }: { g: Group }) => { const b = BL[g.building]!; return <><div className="rowtitle" style={{ fontSize: 13 }}>{b.name}</div><div className="rowsub"><span className="client">{CL[b.client]!.name}</span></div></>; };
const ReqCell = ({ g }: { g: Group }) => { const c = CATS[g.cat]; return <>{c.req}<div className="rowsub">{c.std} · {intervalWord(c.months)}</div></>; };
const ARef = ({ a }: { a: Asset }) => <a className="ref" href={pathTo(a)}>{a.id}</a>;
const GRef = ({ g }: { g: Group }) => <ARef a={AS[g.assetIds[0]!]!} />;
const BookingTag = ({ g }: { g: Group }) => g.booking ? <span className="tag tag-aqua">{g.booking.onSite ? 'On site now' : `Booked ${fmtS(g.booking.date)}`}</span> : null;
const RemTag = ({ g }: { g: Group }) => { const n = groupRems(g).length; return n ? <span className="tag tag-caution">{n} remedial</span> : null; };
const NotifiedTag = ({ g }: { g: Group }) => g.notified ? <span className="tag tag-quiet">Client told {fmtS(g.notified)}</span> : null;
const SecH = ({ children, right }: { children: ReactNode; right?: ReactNode }) => <div className="sec-h">{children}{right}</div>;
const BtnQ = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={`btn btn-q ${p.className ?? ''}`} />;
const Btn = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={`btn ${p.className ?? ''}`} />;

export function PortfolioOffice({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  useModel();
  const mounted = useMounted();
  const { hash, go } = useHashRoute(HOME);
  const [assetFilter, setAssetFilter] = useState<'action' | 'all'>('action');
  const [dueWin, setDueWin] = useState(30);
  const [repType, setRepType] = useState('all');
  const [attnOpen, setAttnOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [q, setQ] = useState('');
  const parts = parseHash(hash);
  const route: Route = { tab: parts[0] ?? 'portfolio', a: parts[1] ?? null, b: parts[2] ?? null, c: parts[3] ?? null };
  useEffect(() => { setMenuOpen(null); setAttnOpen(false); setQ(''); }, [hash]);
  if (!mounted) return <div className="cm cm-loading">Loading compliance workspace</div>;

  const close = () => setDialog(null);
  const doExport = (what: string) => toast(`${what[0]!.toUpperCase()}${what.slice(1)} would download here. Exports are not built yet.`);
  const planned = (what: string) => { setMenuOpen(null); toast(`${what} is planned, not built. Nothing was changed.`); };
  const bookNext = (opts: { client?: string; building?: string; late?: boolean }) => {
    let pool = opts.late ? lateItems() : dueItems(90).concat(lateItems());
    if (opts.client) pool = pool.filter(g => g.client === opts.client); if (opts.building) pool = pool.filter(g => g.building === opts.building);
    pool = pool.filter(g => !g.booking).sort((x, y) => (status(x).days ?? 999) - (status(y).days ?? 999));
    if (!pool[0]) { toast('Nothing here needs booking.'); return; } setDialog({ kind: 'book', g: pool[0] });
  };
  const onRootClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement; const a = el.closest('a[href^="#/"]');
    if (a && !e.ctrlKey && !e.metaKey) { e.preventDefault(); go(a.getAttribute('href')!); return; }
    if (menuOpen && !el.closest('.menu')) setMenuOpen(null);
    if (attnOpen && !el.closest('.attn-pop') && !el.closest('.bell')) setAttnOpen(false);
  };

  const ctx: Ctx = { route, assetFilter, setAssetFilter, dueWin, setDueWin, repType, setRepType, menuOpen, setMenuOpen, setDialog, go, doExport, planned, bookNext };
  const attn = attentionItems();
  const tabs: [string, string, number | null, boolean][] = [
    ['portfolio', 'Portfolio', CLIENTS.length, false], ['due', 'Due', dueItems(30).length, false], ['overdue', 'Overdue', lateItems().length, true],
    ['remedials', 'Remedials', remedials.filter(r => r.status === 'open').length, true], ['reports', 'Reports', events.length, false], ['engineers', 'Engineers', ENGINEERS.length, false], ['admin', 'Admin', null, false],
  ];
  const results = q.trim().length >= 2 ? search(q) : [];

  return <div className="cm cm-office" onClick={onRootClick}>
    <header className="topbar">
      <a className="logo" href="#/portfolio" aria-label="Portfolio"><b>RELAY</b><span>LEODIS COMPLIANCE</span></a>
      <div className="search">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search assets, buildings, serials, report refs" autoComplete="off" aria-label="Search" />
        <kbd>/</kbd>
        {q.trim() !== '' && <div className="results">{results.length ? results.map(r => r.event
          ? <a key={r.ref} href="#/reports" onClick={e => { e.preventDefault(); e.stopPropagation(); setDialog({ kind: 'report', e: r.event! }); setQ(''); }}><span className="ref">{r.ref}</span><span>{r.t}</span><span className="k">{r.k}</span></a>
          : <a key={r.ref + r.go} href={r.go}><span className="ref">{r.ref}</span><span>{r.t}</span><span className="k">{r.k}</span></a>)
          : <div className="none">Nothing matches “{q}”.</div>}</div>}
      </div>
      <div className="topbar-right">
        <button type="button" className={`bell ${attn.length ? '' : 'quiet'}`} onClick={() => setAttnOpen(o => !o)}>Attention <b>{attn.length}</b></button>
        <span className="whoami">{userName} · <em>{roleLabel}</em></span>
        <ThemeToggle />
        <Link className="tbtn" href="/">Companies</Link>
      </div>
      {attnOpen && <div className="attn-pop panel">
        <div className="panel-head"><h4 style={{ color: 'var(--alert)' }}>Needs attention</h4><a className="more" href="#/overdue">Overdue list →</a></div>
        {attn.length ? attn.map(i => <a key={i.t} className="mini" href={i.go}><div className="mini-b"><b>{i.t}</b><div className="rowsub">{i.s}</div></div><span className="age">→</span></a>) : <div className="empty">Nothing needs attention.</div>}
      </div>}
    </header>
    <nav className="hnav">{tabs.map(([k, l, n, warn]) => <a key={k} href={`#/${k}`} className={route.tab === k ? 'on' : ''}>{l}{n !== null && <i className={n && warn ? 'warn' : ''}>{n}</i>}</a>)}</nav>
    {route.tab === 'due' ? <DueView ctx={ctx} /> : route.tab === 'overdue' ? <OverdueView ctx={ctx} /> : route.tab === 'remedials' ? <RemedialsView ctx={ctx} />
      : route.tab === 'reports' ? <ReportsView ctx={ctx} /> : route.tab === 'engineers' ? <EngineersView ctx={ctx} /> : route.tab === 'admin' ? <AdminView ctx={ctx} /> : <PortfolioView ctx={ctx} />}
    {dialog && <Dialogs d={dialog} close={close} />}
    <Toasts />
  </div>;
}

interface Ctx {
  route: Route; assetFilter: 'action' | 'all'; setAssetFilter: (v: 'action' | 'all') => void; dueWin: number; setDueWin: (n: number) => void;
  repType: string; setRepType: (s: string) => void; menuOpen: string | null; setMenuOpen: (s: string | null) => void; setDialog: (d: Dialog | null) => void;
  go: (h: string) => void; doExport: (what: string) => void; planned: (what: string) => void; bookNext: (o: { client?: string; building?: string; late?: boolean }) => void;
}

/* -------------------------------------------------------------- search */
interface Hit { ref: string; t: string; k: string; go: string; event?: Event }
function search(raw: string): Hit[] {
  const q = raw.trim().toLowerCase(); const out: Hit[] = [];
  CLIENTS.forEach(c => { if (c.name.toLowerCase().includes(q)) out.push({ ref: c.code, t: c.name, k: 'client', go: `#/portfolio/${c.code}` }); });
  BUILDINGS.forEach(b => { if (b.name.toLowerCase().includes(q) || b.code.toLowerCase() === q) out.push({ ref: `${b.client}-${b.code}`, t: b.name, k: 'building', go: `#/portfolio/${b.client}/${b.code}` }); });
  groups.forEach(g => { const a = AS[g.assetIds[0]!]!; const hay = `${g.label} ${a.id} ${a.make} ${a.loc} ${a.serial ?? ''} ${CATS[g.cat].label}`.toLowerCase(); if (hay.includes(q)) out.push({ ref: a.id, t: `${g.label} · ${BL[g.building]!.name}`, k: CATS[g.cat].label, go: pathTo(a) }); });
  if (out.length < 8) assets.forEach(a => { if (GR[a.groupId]!.assetIds.length > 1 && (a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))) out.push({ ref: a.id, t: `${a.name} · ${BL[a.building]!.name}`, k: 'asset', go: pathTo(a) }); });
  events.forEach(e => { if (e.id.toLowerCase().includes(q)) out.push({ ref: e.id, t: `${e.type} · ${GR[e.groupId]!.label}`, k: 'report', go: '#/reports', event: e }); });
  return out.slice(0, 10);
}

/* ----------------------------------------------------------- portfolio */
function PortfolioView({ ctx }: { ctx: Ctx }) {
  const { route } = ctx;
  const client = route.a ? CL[route.a] ?? null : null;
  const building = client && route.b && BL[route.b]?.client === client.code ? BL[route.b]! : null;
  const asset = building && route.c && AS[route.c]?.building === building.code ? AS[route.c]! : null;
  return <div className="cols">
    <div className="col" data-col="1"><div className="col-head"><h4>Clients</h4><i>{CLIENTS.length}</i></div>
      {CLIENTS.map(c => { const r = rollup(groupsOfClient(c.code)); return <a key={c.code} className={`item ${client?.code === c.code ? 'on' : ''}`} href={`#/portfolio/${c.code}`}>
        <div className="item-top"><div className="rowtitle">{c.name}</div><span className="arrow">›</span></div><Bar c={r} /><Meta c={r} extra={plural(buildingsOf(c.code).length, 'building')} /></a>; })}
      <div className="colpad sticky-foot"><BarKey /></div>
    </div>
    <div className="col" data-col="2">
      {!client ? <><div className="col-head"><h4>Buildings</h4></div><div className="empty">Select a client to see its buildings.</div></> : <>
        <div className="col-head"><h4>Buildings · {client.name}</h4><i>{buildingsOf(client.code).length}</i></div>
        {buildingsOf(client.code).map(b => { const r = rollup(groupsOfBuilding(b.code)); return <a key={b.code} className={`item ${building?.code === b.code ? 'on' : ''}`} href={`#/portfolio/${client.code}/${b.code}`}>
          <div className="item-top"><div className="rowtitle">{b.name}</div><span className="arrow">›</span></div><div className="rowsub">{b.kind} · {b.rp}</div><Bar c={r} /><Meta c={r} /></a>; })}
        <div className="colpad sticky-foot"><div className="rowsub" style={{ marginBottom: 8 }}>Client-level actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BtnQ className="btn-sm" style={{ textAlign: 'left' }} onClick={() => ctx.setDialog({ kind: 'statement', client: client.code })}>Portfolio compliance statement</BtnQ>
            <BtnQ className="btn-sm" style={{ textAlign: 'left' }} onClick={() => ctx.doExport(`asset register for ${client.name}`)}>Asset register export</BtnQ>
          </div></div></>}
    </div>
    <AssetsCol ctx={ctx} building={building} asset={asset} />
    <div className="col" data-col="4"><div className="col-head"><h4>Details</h4><i>{asset ? asset.id : building ? building.name : client ? client.name : 'Portfolio'}</i></div>
      <div className="colpad">{asset ? <AssetSheet ctx={ctx} a={asset} /> : building ? <BuildingSheet ctx={ctx} b={building} /> : client ? <ClientSheet ctx={ctx} c={client} /> : <PortfolioSheet ctx={ctx} />}</div>
    </div>
  </div>;
}
function AssetsCol({ ctx, building, asset }: { ctx: Ctx; building: Building | null; asset: Asset | null }) {
  if (!building) return <div className="col" data-col="3"><div className="col-head"><h4>Assets</h4></div><div className="empty">Select a building to see its assets.</div></div>;
  const all = groupsOfBuilding(building.code).flatMap(g => g.assetIds.map(id => AS[id]!));
  const needs = (a: Asset) => status(GR[a.groupId]!).key !== 'ok' || openRems(a).length > 0;
  const shown = ctx.assetFilter === 'all' ? all : all.filter(needs);
  const cats = [...new Set(shown.map(a => a.cat))];
  return <div className="col" data-col="3"><div className="col-head"><h4>Assets · {building.name}</h4><i>{all.length}</i></div>
    <div className="filters" style={{ border: 0, borderBottom: '1px solid var(--line)', padding: '8px 16px' }}>
      <button type="button" className={`chip ${ctx.assetFilter === 'action' ? 'on' : ''}`} onClick={() => ctx.setAssetFilter('action')}>Needs action · {all.filter(needs).length}</button>
      <button type="button" className={`chip ${ctx.assetFilter === 'all' ? 'on' : ''}`} onClick={() => ctx.setAssetFilter('all')}>All · {all.length}</button>
    </div>
    {cats.length ? cats.map(cat => { const list = shown.filter(a => a.cat === cat); return <div key={cat}>
      <div className="grp">{CATS[cat].label}<i>{list.length}{ctx.assetFilter !== 'all' && ` of ${all.filter(a => a.cat === cat).length}`}</i></div>
      {list.map(a => { const g = GR[a.groupId]!; return <a key={a.id} className={`arow ${asset?.id === a.id ? 'on' : ''}`} href={pathTo(a)}><span className="ref">{a.id}</span><span className="nm">{a.name}</span>{openRems(a).length ? <span className="tag tag-caution">Remedial</span> : <Tag s={status(g)} />}</a>; })}
    </div>; }) : <div className="empty">Nothing needs action at {building.name}.<br />{all.length} assets are all in date.</div>}
    <div className="colpad sticky-foot"><div className="rowsub">{ctx.assetFilter === 'all' ? `Showing all ${all.length}.` : `Filtered to ${shown.length} that need action; ${all.length - shown.length} in date hidden.`} Grouped assets share one visit and one report.</div></div>
  </div>;
}
function PortfolioSheet({ ctx }: { ctx: Ctx }) {
  const r = rollup(groups); const late = lateItems(), due = dueItems(30), nr = noneItems();
  return <div className="sheet"><div className="sheet-title"><div><div className="crumbs">Leodis Compliance Management</div><h4>Portfolio position</h4><div className="rowsub">{CLIENTS.length} clients · {BUILDINGS.length} buildings · {assets.length} tracked assets · {fmt(TODAY)}</div></div>
    <div className="actions"><BtnQ className="btn-sm" onClick={() => ctx.doExport('portfolio due list')}>Export due list</BtnQ></div></div>
    <dl className="dueblock"><div><dt>In date</dt><dd className="okc">{Math.round(100 * r.ok / r.total)}%<small>of tracked assets</small></dd></div><div><dt>Overdue</dt><dd className="late">{late.length}<small>{plural(late.filter(g => !g.booking).length, 'item')} not yet booked</small></dd></div><div><dt>Due in 30 days</dt><dd className="soon">{due.length}<small>{plural(due.filter(g => !g.booking).length, 'item')} need a booking</small></dd></div></dl>
    <div style={{ marginTop: 12 }}><Bar c={r} /><div className="meta" style={{ marginTop: 6 }}><span>{r.ok} in date</span><span className="soon">{r.soon} due</span><span className="late">{r.late} overdue</span><span>{r.none} no record</span></div></div>
    <SecH>Needs attention</SecH>
    <div className="rmenu">{attentionItems().map(i => <a key={i.t} href={i.go}><div className="rt"><b>{i.t}</b><span>{i.s}</span></div><span className="age">→</span></a>)}</div>
    <SecH right={<a href="#/overdue">All {late.length} →</a>}>Overdue now</SecH>
    <table className="reg tight"><tbody>{late.slice(0, 5).map(g => <tr key={g.id}><td><GRef g={g} /><div className="rowsub">{g.label}</div></td><td>{BL[g.building]!.name}</td><td><DueCell s={status(g)} /></td><td>{g.booking ? <BookingTag g={g} /> : <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'book', g })}>Book</Btn>}</td></tr>)}</tbody></table>
    <SecH>Warranties ending</SecH>
    <div className="rmenu">{warrantyWatch().slice(0, 5).map(a => { const d = dayDiff(a.warrantyEnd!, TODAY); return <a key={a.id} href={pathTo(a)}><span className="ref">{a.id}</span><div className="rt"><b>{a.name}</b><span>{BL[a.building]!.name} · {a.warrantyNote ?? 'warranty'}</span></div><span className={`due ${d < 0 ? 'late' : d <= 45 ? 'soon' : ''}`}>{d < 0 ? `lapsed ${fmtS(a.warrantyEnd)}` : fmtS(a.warrantyEnd)}</span></a>; })}</div>
    <p className="rowsub" style={{ marginTop: 16 }}>Select a client on the left to drill in. “No record” ({nr.length} items) means the register holds the asset but no certificate or service date has been entered. It is neither overdue nor compliant.</p>
  </div>;
}
function ClientSheet({ ctx, c }: { ctx: Ctx; c: Client }) {
  const bs = buildingsOf(c.code); const r = rollup(groupsOfClient(c.code));
  const late = lateItems().filter(g => g.client === c.code), due = dueItems(30).filter(g => g.client === c.code);
  const reps = events.filter(e => e.client === c.code).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);
  return <div className="sheet"><div className="sheet-title"><div><div className="crumbs"><a href="#/portfolio">Portfolio</a><span>›</span>Client</div><h4>{c.name}</h4><div className="rowsub">{plural(bs.length, 'building')} · {r.total} assets · client since {c.since}</div></div>
    <div className="actions"><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'statement', client: c.code })}>Compliance statement</BtnQ><Btn className="btn-sm" onClick={() => ctx.bookNext({ client: c.code })}>Book next due</Btn></div></div>
    <dl className="dueblock"><div><dt>In date</dt><dd className="okc">{Math.round(100 * r.ok / r.total)}%<small>{r.ok} of {r.total} assets</small></dd></div><div><dt>Overdue</dt><dd className={late.length ? 'late' : ''}>{late.length}<small>{late.length ? `${plural(late.filter(g => !g.booking).length, 'item')} not booked` : 'nothing overdue'}</small></dd></div><div><dt>Due in 30 days</dt><dd className={due.length ? 'soon' : ''}>{due.length}<small>{plural(due.filter(g => g.booking).length, 'item')} booked</small></dd></div></dl>
    <dl className="tb two"><div><dt>Contact</dt><dd>{c.contact} · {c.role}</dd></div><div><dt>Reports go to</dt><dd className="num" style={{ fontSize: 12 }}>{c.email}</dd></div><div><dt>Open remedials</dt><dd>{remedials.filter(x => x.status === 'open' && AS[x.assetId]!.client === c.code).length}</dd></div><div><dt>Reports this year</dt><dd>{events.filter(e => e.client === c.code && e.date.getFullYear() === TODAY.getFullYear()).length}</dd></div></dl>
    <SecH>Buildings</SecH>
    <table className="reg tight"><thead><tr><th>Building</th><th>Assets</th><th>Position</th><th>Next due</th></tr></thead><tbody>{bs.map(b => { const gs = groupsOfBuilding(b.code); const rb = rollup(gs); const nxt = gs.filter(g => status(g).next).sort((x, y) => status(x).next!.getTime() - status(y).next!.getTime())[0]; return <tr key={b.code} className="clickable" onClick={() => ctx.go(`#/portfolio/${c.code}/${b.code}`)}><td><div className="rowtitle" style={{ fontSize: 13 }}>{b.name}</div><div className="rowsub">{b.kind}</div></td><td className="num">{rb.total}</td><td style={{ minWidth: 120 }}><Bar c={rb} /><Meta c={rb} /></td><td>{nxt ? <DueCell s={status(nxt)} /> : '—'}</td></tr>; })}</tbody></table>
    <SecH right={<a href={`#/reports/${c.code}`}>All →</a>}>Latest reports</SecH>
    <div className="rmenu">{reps.map(e => <button type="button" key={e.id} onClick={() => ctx.setDialog({ kind: 'report', e })}><span className="ref">{e.id}</span><div className="rt"><b>{GR[e.groupId]!.label}</b><span>{BL[e.building]!.name} · {engName(e.eng)} · {fmt(e.date)}</span></div><ResultTag r={e.result} /></button>)}</div>
  </div>;
}
function BuildingSheet({ ctx, b }: { ctx: Ctx; b: Building }) {
  const gs = groupsOfBuilding(b.code); const r = rollup(gs); const c = CL[b.client]!;
  const rems = remedials.filter(x => x.status === 'open' && AS[x.assetId]!.building === b.code);
  const reps = events.filter(e => e.building === b.code).sort((x, y) => y.date.getTime() - x.date.getTime()).slice(0, 4);
  return <div className="sheet"><div className="sheet-title"><div><div className="crumbs"><a href="#/portfolio">Portfolio</a><span>›</span><a href={`#/portfolio/${c.code}`}>{c.name}</a><span>›</span>Building</div><h4>{b.name}</h4><div className="rowsub">{b.kind} · {b.rp}</div></div>
    <div className="actions"><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'statement', building: b.code })}>Compliance statement</BtnQ><Btn className="btn-sm" onClick={() => ctx.bookNext({ building: b.code })}>Book a visit</Btn></div></div>
    <div style={{ marginTop: 16 }}><Bar c={r} /><Meta c={r} /></div>
    <SecH>Requirements at this building</SecH>
    <table className="reg tight"><thead><tr><th>Requirement</th><th>Assets</th><th>Last done</th><th>Next due</th><th>Status</th></tr></thead><tbody>
      {gs.map(g => { const s = status(g); const a = AS[g.assetIds[0]!]!; return <tr key={g.id} className="clickable" onClick={() => ctx.go(pathTo(a))}><td><div className="rowtitle" style={{ fontSize: 13 }}>{g.label}</div><div className="rowsub">{CATS[g.cat].req} · {CATS[g.cat].std}</div></td><td className="num">{g.assetIds.length}</td><td className="due">{fmt(g.last)}</td><td><DueCell s={s} /></td><td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Tag s={s} /><BookingTag g={g} /><RemTag g={g} /></td></tr>; })}
    </tbody></table>
    {rems.length > 0 && <><SecH right={<a href="#/remedials">All →</a>}>Open remedials</SecH><div className="rmenu">{rems.map(x => <a key={x.id} href={pathTo(AS[x.assetId]!)}><span className="ref">{x.id}</span><div className="rt"><b>{x.title}</b><span>{AS[x.assetId]!.name} · raised {fmtS(x.raised)} · {x.owner ? engName(x.owner) : 'unassigned'} · target {fmtS(x.target)}</span></div>{x.owner ? <span className="tag tag-caution">Assigned</span> : <span className="tag tag-alert">Unassigned</span>}</a>)}</div></>}
    <SecH right={<a href={`#/reports/${c.code}/${b.code}`}>All →</a>}>Latest reports</SecH>
    <div className="rmenu">{reps.map(e => <button type="button" key={e.id} onClick={() => ctx.setDialog({ kind: 'report', e })}><span className="ref">{e.id}</span><div className="rt"><b>{GR[e.groupId]!.label}</b><span>{engName(e.eng)} · {fmt(e.date)} · sent to {c.contact}</span></div><ResultTag r={e.result} /></button>)}</div>
  </div>;
}
function AssetSheet({ ctx, a }: { ctx: Ctx; a: Asset }) {
  const g = GR[a.groupId]!; const b = BL[a.building]!; const c = CL[a.client]!; const cat = CATS[a.cat]; const s = status(g);
  const hist = eventsOf(g); const rems = openRems(a); const closed = a.remedials.map(id => remedials.find(r => r.id === id)).filter((r): r is Remedial => !!r && r.status === 'closed');
  const wd = a.warrantyEnd ? dayDiff(a.warrantyEnd, TODAY) : null;
  const siblings = groupsOfBuilding(b.code).filter(x => x.id !== g.id && ['soon', 'late'].includes(status(x).key)).sort((x, y) => (status(x).days ?? 0) - (status(y).days ?? 0)).slice(0, 3);
  const dutyHolder = b.rp.split(': ')[1] ?? c.contact;
  const menuId = `report-${a.id}`;
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/portfolio/${c.code}`}>{c.name}</a><span>›</span><a href={`#/portfolio/${c.code}/${b.code}`}>{b.name}</a><span>›</span>{cat.label}</div><h4>{a.name}</h4><div className="rowsub"><span className="ref">{a.id}</span><span className="sep">/</span>{a.make}<span className="sep">/</span>{a.loc}</div></div>
      <div className="actions"><div className="menu"><BtnQ className="btn-sm drop" onClick={() => ctx.setMenuOpen(ctx.menuOpen === menuId ? null : menuId)}>Report</BtnQ>
        {ctx.menuOpen === menuId && <div className="menu-pop rmenu">
          <button type="button" onClick={() => { ctx.setMenuOpen(null); ctx.setDialog({ kind: 'newreport', g, mode: 'file' }); }}><div className="rt"><b>Service report</b><span>What was done on a visit, with readings and photos</span></div><span className="tag tag-aqua">Available</span></button>
          {[[cat.rtype === 'CERT' ? `${cat.label} certificate` : cat.rtype === 'RA' ? 'Risk assessment reissue' : cat.rtype === 'TER' ? 'Thorough examination report' : 'Test certificate', 'Statutory record issued from the inspection'], ['Remedial works report', 'Fault found, work quoted, work done'], ['Condition survey', 'Life expectancy and replacement advice']].map(([t, d]) => <button type="button" key={t} onClick={() => ctx.planned(t!)}><div className="rt"><b>{t}</b><span>{d}</span></div><span className="tag tag-quiet">Planned</span></button>)}
        </div>}</div>
        {g.booking ? <BtnQ className="btn-sm" onClick={() => { unbook(g); toast(`Booking cancelled for ${g.label}.`); }}>Cancel booking</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'book', g })}>Book {s.key === 'none' ? 'first visit' : cat.req.toLowerCase().startsWith('annual') ? 'test' : 'service'}</Btn>}</div></div>
    {g.assetIds.length > 1 && <div className="note info"><span><b>One of {g.assetIds.length} {cat.unit}s checked together.</b> The {cat.req.toLowerCase()} covers the whole set on one visit, so dates, bookings and reports below belong to the group.</span></div>}
    <dl className="dueblock"><div><dt>Requirement</dt><dd className="txt">{cat.req}<small>{cat.std} · {intervalWord(cat.months)}</small></dd></div>
      <div><dt>Last done</dt><dd>{g.last ? fmt(g.last) : <span className="fine">None</span>}<small>{hist[0] ? <>{engName(hist[0].eng)} · <span className="ref" style={{ fontSize: 11 }}>{hist[0].id.split('-').slice(2).join('-')}</span> · {hist[0].result === 'pass' ? 'satisfactory' : 'fault found'}</> : 'no report on file'}</small></dd></div>
      <div><dt>Next due</dt><dd className={s.key === 'late' ? 'late' : s.key === 'soon' ? 'soon' : s.key === 'none' ? 'fine' : 'okc'}>{s.next ? fmt(s.next) : 'Not known'}<small>{s.key === 'late' ? `${-(s.days ?? 0)} days overdue` : s.key === 'soon' ? `${s.days} days` : s.key === 'none' ? 'enter a record to compute it' : `${s.days} days · in date`}{g.booking && ` · booked ${fmtS(g.booking.date)} with ${engName(g.booking.eng)}`}</small></dd></div></dl>
    {g.booking && <div className="note good"><span><b>{g.booking.onSite ? 'On site now' : `Booked ${fmt(g.booking.date)}`}</b> · {engName(g.booking.eng)} · {g.booking.note ?? cat.req}</span>{!g.booking.onSite && <BtnQ className="btn-sm" onClick={() => { unbook(g); toast(`Booking cancelled for ${g.label}.`); }}>Cancel</BtnQ>}</div>}
    {s.key === 'late' && !g.booking && <div className="note bad"><span><b>{-(s.days ?? 0)} days past its statutory date.</b> {dutyHolder} is the duty holder{g.notified ? ` and was told on ${fmt(g.notified)}` : ' and has not been told'}.</span>{!g.notified && <BtnQ className="btn-sm" onClick={() => { notify(g); toast(`${dutyHolder} notified about ${g.label} at ${b.name}.`); }}>Notify duty holder</BtnQ>}</div>}
    {s.key === 'none' && <div className="note warn"><span><b>No record held.</b> The asset is on the register but no certificate or service date has been entered. Enter the last known record, or book a first visit.</span><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'newreport', g, mode: 'record' })}>Enter record</BtnQ></div>}
    {(a.installed || a.serial) && <dl className={`tb two ${a.batt ? '' : 'single'}`} style={{ marginTop: 12 }}>
      <div><dt>{a.warrantyNote && a.warrantyNote !== 'Panel' ? `${a.warrantyNote} warranty` : 'Warranty'}</dt><dd>{a.warrantyEnd ? <>to <span className={`num ${wd! < 0 ? 'late' : wd! <= 90 ? 'soon' : ''}`}>{fmt(a.warrantyEnd)}</span>{wd! < 0 && ' · lapsed'}</> : 'Not recorded'}</dd></div>
      <div><dt>Installed</dt><dd className="num">{a.installed ? `${fmt(a.installed)} · Leodis M&E` : '—'}</dd></div>
      {a.batt && <><div><dt>Batteries</dt><dd>12-month · to <span className="num">{fmt(a.batt)}</span></dd></div><div><dt>Serial</dt><dd className="num">{a.serial ?? '—'}</dd></div></>}
    </dl>}
    {wd !== null && wd <= 90 && wd >= -60 && (wd < 0 ? <div className="note bad"><span><b>Warranty lapsed {fmt(a.warrantyEnd)}.</b> Faults from here are chargeable to {c.name}.</span></div>
      : s.next && dayDiff(a.warrantyEnd!, s.next) > 0 && dayDiff(a.warrantyEnd!, s.next) <= 60 ? <div className="note warn"><span><b>Warranty ends {dayDiff(a.warrantyEnd!, s.next)} days after the next {cat.req.toLowerCase()}.</b> A fault found then is still covered — worth bringing the visit forward rather than letting it drift.</span><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'book', g, early: true })}>Bring forward</BtnQ></div>
      : <div className="note warn"><span><b>Warranty ends {fmt(a.warrantyEnd)}</b> ({wd} days). {c.contact} may want a pre-expiry check.</span><BtnQ className="btn-sm" onClick={() => { notify(g); toast(`${c.contact} notified about the warranty on ${a.name}.`); }}>Notify client</BtnQ></div>)}
    {rems.length > 0 && <><SecH>Open remedials</SecH><div className="rmenu">{rems.map(x => <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--line)' }}><span className="ref" style={{ fontSize: 11, width: 70, flex: 'none' }}>{x.id}</span><div className="rt" style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{x.title}</b><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Raised {fmt(x.raised)} · target {fmt(x.target)} · {x.owner ? `owner ${engName(x.owner)}` : <span className="late">unassigned</span>}</span></div><div className="actions">{!x.owner && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'assign', r: x })}>Assign</Btn>}<BtnQ className="btn-sm" onClick={() => { closeRemedial(x, 'CS'); toast(`${x.id} closed, ${fmt(TODAY)}.`); }}>Close</BtnQ></div></div>)}</div></>}
    <SecH right={<span style={{ marginLeft: 'auto', color: 'var(--text-3)', letterSpacing: '.06em' }}>{plural(hist.length, 'report')}</span>}>Service history</SecH>
    {hist.length ? hist.map(e => <div key={e.id} className="hist"><span className="d">{fmt(e.date)}</span><div className="b"><p>{e.type} · <button type="button" className="ref" style={{ fontSize: 11 }} onClick={() => ctx.setDialog({ kind: 'report', e })}>{e.id}</button></p><div className="rowsub">{engName(e.eng)} · {e.notes.length > 110 ? `${e.notes.slice(0, 108)}…` : e.notes}</div></div><ResultTag r={e.result} /></div>) : <div className="empty" style={{ padding: 16 }}>No reports on file for this asset.</div>}
    {closed.length > 0 && <><SecH>Closed remedials</SecH>{closed.map(x => <div key={x.id} className="hist"><span className="d">{fmt(x.closed)}</span><div className="b"><p>{x.title}</p><div className="rowsub">{x.id} · raised {fmtS(x.raised)} · {engName(x.owner)}</div></div><span className="tag tag-ok">Closed</span></div>)}</>}
    <div className="two" style={{ marginTop: 8 }}>
      <div><SecH right={<button type="button" onClick={() => ctx.doExport('document folder')}>Folder →</button>}>Documents</SecH>
        <div className="rmenu">{hist.filter(e => CATS[e.cat].rtype !== 'SVR' || e === hist[0]).slice(0, 3).map(e => <button type="button" key={e.id} onClick={() => ctx.setDialog({ kind: 'report', e })}><span className="ref">{e.id.split('-').slice(2).join('-')}</span><div className="rt"><b>{e.type} {e.date.getFullYear()}</b><span>PDF · {fmt(e.date)}</span></div></button>)}
          {a.installed && <button type="button" onClick={() => ctx.doExport('commissioning pack')}><span className="ref">COMM-{a.installed.getFullYear()}</span><div className="rt"><b>Commissioning &amp; warranty</b><span>PDF · {fmt(a.installed)}</span></div></button>}</div></div>
      <div><SecH>Also falling due here</SecH>
        <div className="rmenu">{siblings.length ? siblings.map(x => <a key={x.id} href={pathTo(AS[x.assetIds[0]!]!)}><span className="ref">{x.assetIds[0]}</span><div className="rt"><b>{x.label}</b><span><DueCell s={status(x)} />{x.booking ? ' · booked' : ' · same visit?'}</span></div><Tag s={status(x)} /></a>) : <div className="empty" style={{ padding: 14 }}>Nothing else due at this building.</div>}</div></div>
    </div>
  </div>;
}

/* ----------------------------------------------------------------- tabs */
function ItemRow({ g, action }: { g: Group; action: ReactNode }) {
  const s = status(g); const a = AS[g.assetIds[0]!]!;
  return <tr><td><GRef g={g} /><div className="rowsub">{g.label}{g.assetIds.length === 1 && ` · ${a.make}`}</div></td><td><ClientLine g={g} /></td><td><ReqCell g={g} /></td><td className="due">{fmt(g.last)}</td><td><DueCell s={s} /></td><td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Tag s={s} /><BookingTag g={g} /><RemTag g={g} /><NotifiedTag g={g} /></td><td>{action}</td></tr>;
}
const BookBtn = ({ g, ctx }: { g: Group; ctx: Ctx }) => g.booking ? <BtnQ className="btn-sm" onClick={() => { unbook(g); toast(`Booking cancelled for ${g.label}.`); }}>Cancel</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'book', g })}>Book</Btn>;
function DueView({ ctx }: { ctx: Ctx }) {
  const clientF = ctx.route.a && CL[ctx.route.a] ? ctx.route.a : 'all';
  const items = dueItems(ctx.dueWin).filter(g => clientF === 'all' || g.client === clientF);
  return <div className="view">
    <div className="pagehead"><div><h3>Falling due</h3><p>{plural(items.length, 'requirement')} inside {ctx.dueWin} days{clientF !== 'all' ? ` for ${CL[clientF]!.name}` : ' across the portfolio'} · {items.filter(g => !g.booking).length} not yet booked</p></div>
      <div className="actions"><BtnQ onClick={() => ctx.doExport('due list')}>Export due list</BtnQ><Btn onClick={() => ctx.bookNext({})}>Book the next due</Btn></div></div>
    <div className="filters">{[30, 60, 90].map(w => <button type="button" key={w} className={`chip ${ctx.dueWin === w ? 'on' : ''}`} onClick={() => ctx.setDueWin(w)}>Next {w} days · {dueItems(w).length}</button>)}
      <span className="spacer" /><label className="rowsub" style={{ margin: 0 }}>Client <select value={clientF} onChange={e => ctx.go(e.target.value === 'all' ? '#/due' : `#/due/${e.target.value}`)}><option value="all">All clients</option>{CLIENTS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label></div>
    <div className="panel"><table className="reg"><thead><tr><th>Item</th><th>Building</th><th>Requirement</th><th>Last done</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
      {items.length ? items.map(g => <ItemRow key={g.id} g={g} action={<BookBtn g={g} ctx={ctx} />} />) : <tr><td colSpan={7} className="empty">Nothing falls due inside {ctx.dueWin} days.</td></tr>}</tbody></table>
      <div className="panel-foot">Sorted by due date. Grouped assets (doors, extinguishers) appear once, because they are one visit and one report. Booking an item offers to include anything else due at the same building.</div></div>
  </div>;
}
function OverdueView({ ctx }: { ctx: Ctx }) {
  const sub = ctx.route.a === 'norecord' ? 'norecord' : 'late'; const late = lateItems(), none = noneItems();
  return <div className="view">
    <div className="pagehead"><div><h3>Overdue</h3><p>{plural(late.length, 'statutory item')} past their date · {late.filter(g => !g.booking).length} not booked · {late.filter(g => !g.notified && !g.booking).length} duty holders not yet told</p></div>
      <div className="actions"><BtnQ onClick={() => { const n = notifyAll(); toast(n ? `${plural(n, 'duty holder')} notified.` : 'Every duty holder has already been told.'); }}>Notify all duty holders</BtnQ><Btn onClick={() => ctx.bookNext({ late: true })}>Book the oldest</Btn></div></div>
    <div className="filters"><a className={`chip warn ${sub === 'late' ? 'on' : ''}`} href="#/overdue">Overdue · {late.length}</a><a className={`chip ${sub === 'norecord' ? 'on' : ''}`} href="#/overdue/norecord">No record · {none.length}</a><span className="spacer" /><span className="rowsub">Oldest first</span></div>
    {sub === 'late' ? <div className="panel"><table className="reg"><thead><tr><th>Item</th><th>Building</th><th>Requirement</th><th>Last done</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
      {late.length ? late.map(g => <ItemRow key={g.id} g={g} action={<div className="actions" style={{ flexWrap: 'nowrap' }}><BookBtn g={g} ctx={ctx} />{!g.notified && <BtnQ className="btn-sm" onClick={() => { notify(g); toast(`${BL[g.building]!.rp.split(': ')[1] ?? CL[g.client]!.contact} notified about ${g.label}.`); }}>Notify</BtnQ>}</div>} />) : <tr><td colSpan={7} className="empty">Nothing is overdue.</td></tr>}</tbody></table>
      <div className="panel-foot">Overdue is a legal position, not a scheduling one: booking a visit does not clear it. Only a filed report moves the date.</div></div>
      : <div className="panel"><div className="panel-head"><h4>Held with no record</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>Enter the last known certificate or service date, or book a first visit</span></div><table className="reg"><thead><tr><th>Item</th><th>Building</th><th>Requirement</th><th>Assets</th><th>Status</th><th></th></tr></thead><tbody>
        {none.length ? none.map(g => <tr key={g.id}><td><GRef g={g} /><div className="rowsub">{g.label}</div></td><td><ClientLine g={g} /></td><td><ReqCell g={g} /></td><td className="num">{g.assetIds.length}</td><td style={{ display: 'flex', gap: 6 }}><Tag s={status(g)} /><BookingTag g={g} /></td><td><div className="actions" style={{ flexWrap: 'nowrap' }}><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'newreport', g, mode: 'record' })}>Enter record</BtnQ><BookBtn g={g} ctx={ctx} /></div></td></tr>) : <tr><td colSpan={6} className="empty">Every requirement on the register has a record.</td></tr>}</tbody></table>
        <div className="panel-foot">“No record” is its own state. It never displays as compliant, and it never counts as overdue until a date exists to be late against.</div></div>}
  </div>;
}
function RemedialsView({ ctx }: { ctx: Ctx }) {
  const f = ['open', 'unassigned', 'closed'].includes(ctx.route.a ?? '') ? ctx.route.a! : 'open';
  const cnt = (k: string) => k === 'closed' ? remedials.filter(r => r.status === 'closed').length : k === 'unassigned' ? remedials.filter(r => r.status === 'open' && !r.owner).length : remedials.filter(r => r.status === 'open').length;
  const list = remedials.filter(r => f === 'closed' ? r.status === 'closed' : r.status === 'open' && (f === 'open' || !r.owner)).sort((x, y) => f === 'closed' ? (y.closed?.getTime() ?? 0) - (x.closed?.getTime() ?? 0) : x.target.getTime() - y.target.getTime());
  return <div className="view">
    <div className="pagehead"><div><h3>Remedials</h3><p>{cnt('open')} open · {cnt('unassigned')} unassigned · {remedials.filter(r => r.status === 'open' && dayDiff(r.target, TODAY) < 0).length} past target</p></div>
      <div className="actions"><BtnQ onClick={() => ctx.doExport('remedials schedule')}>Export schedule</BtnQ><Btn onClick={() => ctx.setDialog({ kind: 'raise' })}>Raise a remedial</Btn></div></div>
    <div className="filters">{['open', 'unassigned', 'closed'].map(k => <a key={k} className={`chip ${k === 'unassigned' ? 'warn' : ''} ${f === k ? 'on' : ''}`} href={`#/remedials/${k}`}>{k[0]!.toUpperCase() + k.slice(1)} · {cnt(k)}</a>)}</div>
    <div className="panel"><table className="reg"><thead><tr><th>Ref</th><th>Asset</th><th>Building</th><th>Raised</th><th>Owner</th><th>Target</th><th>Status</th><th></th></tr></thead><tbody>
      {list.length ? list.map(r => { const a = AS[r.assetId]!; const td = dayDiff(r.target, TODAY); return <tr key={r.id}><td><span className="ref">{r.id}</span></td><td><ARef a={a} /><div className="rowtitle" style={{ fontSize: 13 }}>{r.title}</div><div className="rowsub">{a.name}</div></td><td><ClientLine g={GR[a.groupId]!} /></td><td className="due">{fmt(r.raised)}</td><td>{r.owner ? engName(r.owner) : <span className="late">Unassigned</span>}</td><td className="due">{r.status === 'closed' ? <span className="fine">closed {fmtS(r.closed)}</span> : <><b className={td < 0 ? 'late' : td <= 7 ? 'soon' : ''}>{fmtS(r.target)}</b> · {td < 0 ? `${-td}d late` : `${td}d`}</>}</td><td>{r.status === 'closed' ? <span className="tag tag-ok">Closed</span> : r.owner ? <span className="tag tag-caution">Assigned</span> : <span className="tag tag-alert">Unassigned</span>}</td><td>{r.status !== 'closed' && <div className="actions" style={{ flexWrap: 'nowrap' }}>{r.owner ? <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'assign', r })}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'assign', r })}>Assign</Btn>}<BtnQ className="btn-sm" onClick={() => { closeRemedial(r, 'CS'); toast(`${r.id} closed, ${fmt(TODAY)}.`); }}>Close</BtnQ></div>}</td></tr>; }) : <tr><td colSpan={8} className="empty">No {f} remedials.</td></tr>}</tbody></table>
      <div className="panel-foot">A remedial belongs to the asset that raised it and to the report that found it. Closing one records who closed it and when; it does not alter the asset&apos;s statutory date.</div></div>
  </div>;
}
function ReportsView({ ctx }: { ctx: Ctx }) {
  const clientF = ctx.route.a && CL[ctx.route.a] ? ctx.route.a : 'all'; const bF = ctx.route.b && BL[ctx.route.b] ? ctx.route.b : null;
  let list = events.slice().sort((x, y) => y.date.getTime() - x.date.getTime());
  if (clientF !== 'all') list = list.filter(e => e.client === clientF); if (bF) list = list.filter(e => e.building === bF);
  if (ctx.repType !== 'all') list = list.filter(e => CATS[e.cat].rtype === ctx.repType);
  const shown = list.slice(0, 80);
  return <div className="view">
    <div className="pagehead"><div><h3>Reports</h3><p>{list.length} on file{bF ? ` for ${BL[bF]!.name}` : clientF !== 'all' ? ` for ${CL[clientF]!.name}` : ''} · {events.filter(e => e.date.getFullYear() === TODAY.getFullYear()).length} filed this year · {events.filter(e => e.result === 'fault').length} found a fault</p></div>
      <div className="actions"><BtnQ onClick={() => ctx.doExport('report register')}>Export register</BtnQ></div></div>
    <div className="filters"><button type="button" className={`chip ${ctx.repType === 'all' ? 'on' : ''}`} onClick={() => ctx.setRepType('all')}>All types</button>{(Object.keys(RTYPES) as (keyof typeof RTYPES)[]).map(k => <button type="button" key={k} className={`chip ${ctx.repType === k ? 'on' : ''}`} onClick={() => ctx.setRepType(k)}>{RTYPES[k]}s · {events.filter(e => CATS[e.cat].rtype === k).length}</button>)}
      <span className="spacer" /><label className="rowsub" style={{ margin: 0 }}>Client <select value={clientF} onChange={e => ctx.go(e.target.value === 'all' ? '#/reports' : `#/reports/${e.target.value}`)}><option value="all">All clients</option>{CLIENTS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label></div>
    <div className="panel"><table className="reg"><thead><tr><th>Reference</th><th>Covers</th><th>Building</th><th>Engineer</th><th>Date</th><th>Result</th><th>Sent to</th></tr></thead><tbody>
      {shown.map(e => <tr key={e.id} className="clickable" onClick={() => ctx.setDialog({ kind: 'report', e })}><td><span className="ref">{e.id}</span><div className="rowsub">{e.type}</div></td><td><div className="rowtitle" style={{ fontSize: 13 }}>{GR[e.groupId]!.label}</div><div className="rowsub">{CATS[e.cat].req}</div></td><td><ClientLine g={GR[e.groupId]!} /></td><td>{engName(e.eng)}</td><td className="due">{fmt(e.date)}</td><td><ResultTag r={e.result} /></td><td style={{ fontSize: 12, color: 'var(--text-2)' }}>{CL[e.client]!.contact}</td></tr>)}</tbody></table>
      <div className="panel-foot">Showing {shown.length} of {list.length}. Select a row to read it. Every report here was generated from a visit against a tracked asset; the register cannot hold a report with no asset.</div></div>
  </div>;
}
function EngineersView({ ctx }: { ctx: Ctx }) {
  const sel = ctx.route.a && ctx.route.a in ENG ? ENG[ctx.route.a as EngineerId] : null;
  const bookingsOf = (id: EngineerId) => groups.filter(g => g.booking?.eng === id).sort((x, y) => x.booking!.date.getTime() - y.booking!.date.getTime());
  const repsOf = (id: EngineerId) => events.filter(e => e.eng === id).sort((x, y) => y.date.getTime() - x.date.getTime());
  const remsOf = (id: EngineerId) => remedials.filter(r => r.status === 'open' && r.owner === id);
  return <div className="view">
    <div className="pagehead"><div><h3>Engineers</h3><p>{ENGINEERS.length} on the compliance rota · {groups.filter(g => g.booking?.onSite).length} on site now · {groups.filter(g => g.booking).length} visits booked</p></div><div className="actions"><BtnQ onClick={() => ctx.doExport('rota')}>Export rota</BtnQ></div></div>
    <div className="two-wide">
      <div className="panel"><table className="reg"><thead><tr><th>Engineer</th><th>Trades</th><th>Today</th><th>Next booked</th><th>Open remedials</th><th>Reports this year</th></tr></thead><tbody>
        {ENGINEERS.map(e => { const bk = bookingsOf(e.id); const today = bk.find(g => dayDiff(g.booking!.date, TODAY) === 0); const next = bk.find(g => dayDiff(g.booking!.date, TODAY) > 0); return <tr key={e.id} className={`clickable ${sel?.id === e.id ? 'sel' : ''}`} onClick={() => ctx.go(`#/engineers/${e.id}`)}><td><div className="rowtitle" style={{ fontSize: 13 }}>{e.full}</div><div className="rowsub">{e.role ?? 'Engineer'}{e.gasSafe && ` · Gas Safe ${e.gasSafe}`}</div></td><td style={{ fontSize: 12 }}>{e.trades.join(', ')}</td><td>{today ? <><span className="tag tag-aqua">On site</span><div className="rowsub">{BL[today.building]!.name}</div></> : <span className="rowsub">Office / travelling</span>}</td><td className="due">{next ? <>{fmtS(next.booking!.date)}<div className="rowsub">{BL[next.building]!.name}</div></> : '—'}</td><td className="num">{remsOf(e.id).length}</td><td className="num">{repsOf(e.id).filter(x => x.date.getFullYear() === TODAY.getFullYear()).length}</td></tr>; })}</tbody></table>
        <div className="panel-foot">Select an engineer to see their diary. Trades decide who is offered when a visit is booked.</div></div>
      {sel ? <div className="panel"><div className="panel-head"><h4>{sel.full}</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>{sel.trades.join(' · ')}</span></div>
        <SecH><span style={{ padding: '0 16px' }}>Booked visits</span></SecH>
        {bookingsOf(sel.id).length ? bookingsOf(sel.id).map(g => <a key={g.id} className="mini" href={pathTo(AS[g.assetIds[0]!]!)}><div className="mini-b"><p>{g.label}</p><div className="rowsub">{BL[g.building]!.name} · {g.booking!.note ?? CATS[g.cat].req}</div></div><span className="age">{g.booking!.onSite ? 'now' : fmtS(g.booking!.date)}</span></a>) : <div className="empty" style={{ padding: 16 }}>Nothing booked.</div>}
        <SecH><span style={{ padding: '0 16px' }}>Open remedials</span></SecH>
        {remsOf(sel.id).length ? remsOf(sel.id).map(r => <a key={r.id} className="mini" href={pathTo(AS[r.assetId]!)}><div className="mini-b"><p>{r.title}</p><div className="rowsub">{r.id} · {BL[AS[r.assetId]!.building]!.name}</div></div><span className={`age ${dayDiff(r.target, TODAY) < 0 ? 'late' : ''}`}>{fmtS(r.target)}</span></a>) : <div className="empty" style={{ padding: 16 }}>None assigned.</div>}
        <SecH><span style={{ padding: '0 16px' }}>Recent reports</span></SecH>
        {repsOf(sel.id).slice(0, 6).map(e => <button type="button" key={e.id} className="mini" style={{ width: '100%', textAlign: 'left' }} onClick={() => ctx.setDialog({ kind: 'report', e })}><div className="mini-b"><p><span className="ref">{e.id}</span></p><div className="rowsub">{GR[e.groupId]!.label} · {BL[e.building]!.name}</div></div><span className="age">{fmtS(e.date)}</span></button>)}
      </div> : <div className="panel"><div className="empty">Select an engineer to see bookings, remedials and recent reports.</div></div>}
    </div>
  </div>;
}
function AdminView({ ctx }: { ctx: Ctx }) {
  const sec = ['requirements', 'access', 'contacts'].includes(ctx.route.a ?? '') ? ctx.route.a! : 'requirements';
  return <div className="view">
    <div className="pagehead"><div><h3>Administration</h3><p>Requirements, people and delivery for Leodis Compliance Management</p></div></div>
    <div className="filters">{[['requirements', 'Requirements & intervals'], ['access', 'Roles & access'], ['contacts', 'Client contacts']].map(([k, l]) => <a key={k} className={`chip ${sec === k ? 'on' : ''}`} href={`#/admin/${k}`}>{l}</a>)}</div>
    {sec === 'requirements' ? <div className="panel"><div className="panel-head"><h4>Requirements &amp; intervals</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>Due dates are computed from the last report and these intervals</span></div>
      <table className="reg"><thead><tr><th>Category</th><th>Requirement</th><th>Standard</th><th>Interval</th><th>Trade</th><th>Report type</th><th>Buildings</th><th>Assets</th><th></th></tr></thead><tbody>
        {CAT_IDS.map(k => { const c = CATS[k]; return <tr key={k}><td><div className="rowtitle" style={{ fontSize: 13 }}>{c.label}</div><div className="rowsub">{k} · {c.group}</div></td><td>{c.req}</td><td className="num" style={{ fontSize: 12 }}>{c.std}</td><td className="num">{c.months >= 12 ? `${c.months / 12} yr` : `${c.months} mo`}</td><td>{c.trade}</td><td>{RTYPES[c.rtype]}</td><td className="num">{new Set(groups.filter(g => g.cat === k).map(g => g.building)).size}</td><td className="num">{assets.filter(a => a.cat === k).length}</td><td><BtnQ className="btn-sm" onClick={() => ctx.planned('Editing intervals')}>Edit</BtnQ></td></tr>; })}</tbody></table>
      <div className="panel-foot">Changing an interval recomputes every due date in that category, so it is an administrator action with an audit entry, not a filter.</div></div>
      : sec === 'access' ? <div className="panel"><div className="panel-head"><h4>Roles &amp; access</h4></div><table className="reg"><thead><tr><th>Person</th><th>Role</th><th>Sees</th><th>Can</th><th>Sign-in</th></tr></thead><tbody>
        {[['Cal Say', 'Compliance manager', 'Everything', 'Book, assign, file, notify, administer', 'Microsoft · Leodis'], ...ENGINEERS.filter(e => e.id !== 'CS').map(e => [e.full, 'Engineer', 'Own bookings and the buildings they visit', 'File reports, close own remedials', 'Microsoft · Leodis']), ...CLIENTS.map(c => [c.contact, `Client viewer · ${c.name}`, `${c.name} only`, 'Read reports and statements', 'Invited · not yet enabled'])].map(r => <tr key={r[0]}><td className="rowtitle" style={{ fontSize: 13 }}>{r[0]}</td><td>{r[1]}</td><td style={{ fontSize: 12 }}>{r[2]}</td><td style={{ fontSize: 12 }}>{r[3]}</td><td><span className={`tag ${r[4]!.startsWith('Invited') ? 'tag-quiet' : 'tag-ok'}`}>{r[4]}</span></td></tr>)}</tbody></table>
        <div className="panel-foot">Client viewers are shown as a future role. Company selection on the hub is navigation, not access control; these rows would be. Actual access is decided by the Microsoft role assignment, as elsewhere in Relay.</div></div>
      : <div className="panel"><div className="panel-head"><h4>Client contacts &amp; delivery</h4></div><table className="reg"><thead><tr><th>Client</th><th>Reports go to</th><th>Duty holders</th><th>Statement cadence</th><th></th></tr></thead><tbody>
        {CLIENTS.map(c => <tr key={c.code}><td className="rowtitle" style={{ fontSize: 13 }}>{c.name}</td><td>{c.contact} · {c.role}<div className="rowsub num">{c.email}</div></td><td style={{ fontSize: 12 }}>{buildingsOf(c.code).map(b => <div key={b.code}>{b.rp.split(': ')[1] ?? b.rp} — {b.name.split(' —')[0]}</div>)}</td><td>{c.code === 'SCA' ? 'Termly' : 'Quarterly'}</td><td><BtnQ className="btn-sm" onClick={() => ctx.planned('Editing contacts')}>Edit</BtnQ></td></tr>)}</tbody></table></div>}
  </div>;
}

/* -------------------------------------------------------------- dialogs */
const EngSelect = ({ name, trade, sel }: { name: string; trade: string; sel?: EngineerId | null }) => <select name={name} defaultValue={sel ?? engineersFor(trade)[0]!.id}>{engineersFor(trade).map(e => <option key={e.id} value={e.id}>{e.full} — {e.trades.slice(0, 2).join(', ')}</option>)}</select>;
function Dialogs({ d, close }: { d: Dialog; close: () => void }) {
  const shell = (title: string, sub: string, body: ReactNode, foot: ReactNode) => <><div className="dlg-head"><div>{sub && <div className="crumbs">{sub}</div>}<h3>{title}</h3></div><button type="button" className="x" onClick={close} aria-label="Close">×</button></div><div className="dlg-body">{body}</div>{foot && <div className="dlg-foot">{foot}</div>}</>;
  const submit = (fn: (v: ReturnType<typeof formValues>) => void) => (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); fn(formValues(e.currentTarget)); close(); };
  if (d.kind === 'book') {
    const g = d.g; const s = status(g); const cat = CATS[g.cat]; const b = BL[g.building]!;
    const suggested = s.next && dayDiff(s.next, TODAY) > 3 && !d.early ? addDays(s.next, -3) : addDays(TODAY, 3);
    const others = groupsOfBuilding(b.code).filter(x => x.id !== g.id && !x.booking && status(x).key !== 'ok');
    return <Modal className="cm-dialog" onClose={close}><form onSubmit={submit(v => { const date = fromISO(v.date!); const eng = v.eng as EngineerId; const also = v.all('also').map(id => GR[id]!); book(g, date, eng, v.note ?? cat.req, also); toast(`Booked ${ENG[eng].name} for ${b.name} on ${fmt(date)}${also.length ? ` · ${plural(also.length + 1, 'item')} in one visit` : ''}.`); })}>
      {shell('Book a visit', `${CL[g.client]!.name} › ${b.name}`, <>
        <div className="note info" style={{ margin: 0 }}><span><b>{g.label}</b> · {cat.req} · {s.key === 'none' ? 'no record held' : s.key === 'late' ? <span className="late">{-(s.days ?? 0)} days overdue</span> : `due ${fmt(s.next)}`}</span></div>
        <div className="f-row"><div className="f"><label>Visit date</label><input name="date" type="date" defaultValue={toISO(suggested)} required /></div><div className="f"><label>Engineer · {cat.trade}</label><EngSelect name="eng" trade={cat.trade} /></div></div>
        <div className="f"><label>Note for the engineer</label><input name="note" defaultValue={`${cat.req}${g.assetIds.length > 1 ? ` · all ${g.assetIds.length} ${cat.unit}s` : ''}`} /></div>
        {others.length > 0 && <div className="f"><label>Also due at {b.name} — include in the same visit</label><div className="checks">{others.slice(0, 6).map(x => <label key={x.id}><input type="checkbox" name="also" value={x.id} defaultChecked={status(x).key === 'late'} /> {x.label} <span className="rowsub" style={{ margin: 0 }}>· {status(x).word.toLowerCase()}{status(x).next && ` ${fmtS(status(x).next)}`}</span></label>)}</div></div>}
        <p className="rowsub" style={{ margin: 0 }}>Booking does not change the compliance status. Only the filed report moves the date.</p></>,
        <><BtnQ onClick={close}>Cancel</BtnQ><button type="submit" className="btn">Book visit</button></>)}</form></Modal>;
  }
  if (d.kind === 'assign') {
    const r = d.r; const a = AS[r.assetId]!; const cat = CATS[a.cat];
    return <Modal className="cm-dialog" onClose={close}><form onSubmit={submit(v => { assign(r, v.eng as EngineerId, fromISO(v.target!)); toast(`${r.id} assigned to ${ENG[v.eng as EngineerId].full}, target ${fmt(r.target)}.`); })}>
      {shell('Assign remedial', `${r.id} · ${BL[a.building]!.name}`, <>
        <div className="note warn" style={{ margin: 0 }}><span><b>{r.title}</b><br />{a.name} · raised {fmt(r.raised)}</span></div>
        <div className="f-row"><div className="f"><label>Owner · {cat.trade}</label><EngSelect name="eng" trade={cat.trade} sel={r.owner} /></div><div className="f"><label>Target date</label><input name="target" type="date" defaultValue={toISO(r.target)} required /></div></div>
        <div className="f"><label>Instruction</label><textarea name="note" placeholder="Parts, access arrangements, who to call on site" defaultValue={r.owner ? '' : `Access via ${BL[a.building]!.rp.split(': ')[1] ?? 'site contact'}. `} /></div></>,
        <><BtnQ onClick={close}>Cancel</BtnQ><button type="submit" className="btn">Assign</button></>)}</form></Modal>;
  }
  if (d.kind === 'newreport') return <NewReportDialog g={d.g} mode={d.mode} close={close} />;
  if (d.kind === 'raise') {
    return <Modal className="cm-dialog" onClose={close}><form onSubmit={submit(v => { const a = AS[v.asset!]!; const r = raiseRemedial(a.id, v.title!, (v.eng || null) as EngineerId | null, fromISO(v.target!)); toast(`${r.id} raised against ${a.name} at ${BL[a.building]!.name}.`); })}>
      {shell('Raise a remedial', 'Against a tracked asset', <>
        <div className="f"><label>Asset</label><select name="asset">{BUILDINGS.map(b => <optgroup key={b.code} label={b.name}>{groupsOfBuilding(b.code).map(g => <option key={g.id} value={g.assetIds[0]}>{g.label} · {g.assetIds[0]}</option>)}</optgroup>)}</select></div>
        <div className="f"><label>What needs doing</label><input name="title" required placeholder="e.g. Replace failed sounder, level 2 corridor" /></div>
        <div className="f-row"><div className="f"><label>Owner</label><select name="eng" defaultValue=""><option value="">Unassigned</option>{ENGINEERS.map(e => <option key={e.id} value={e.id}>{e.full}</option>)}</select></div><div className="f"><label>Target</label><input name="target" type="date" defaultValue={toISO(addDays(TODAY, 28))} required /></div></div></>,
        <><BtnQ onClick={close}>Cancel</BtnQ><button type="submit" className="btn">Raise</button></>)}</form></Modal>;
  }
  if (d.kind === 'report') return <ReportSheet e={d.e} close={close} />;
  if (d.kind === 'statement') return <Statement scope={d} close={close} />;
  return null;
}
function NewReportDialog({ g, mode, close }: { g: Group; mode: 'file' | 'record'; close: () => void }) {
  const cat = CATS[g.cat]; const s = status(g); const b = BL[g.building]!; const record = mode === 'record';
  const [result, setResult] = useState<'pass' | 'fault'>('pass');
  const [notes, setNotes] = useState(record ? 'Record entered from client paperwork; certificate to be attached.' : findings(g.cat, false));
  const defaultDate = record ? addMonths(TODAY, -Math.floor(cat.months / 2)) : (g.booking && g.booking.date <= TODAY ? g.booking.date : TODAY);
  return <Modal className="cm-dialog" onClose={close}><form onSubmit={e => { e.preventDefault(); const v = formValues(e.currentTarget); const out = fileReport(g, fromISO(v.date!), v.eng as EngineerId, result, notes, v.remtitle || undefined); toast(out.remedial ? `Filed ${out.event.id} and raised ${out.remedial.id}. Sent to ${CL[g.client]!.contact}.` : `${record ? 'Record saved as' : 'Filed'} ${out.event.id} · next ${cat.req.toLowerCase()} due ${fmt(addMonths(out.event.date, cat.months))}. Sent to ${CL[g.client]!.contact}.`); close(); }}>
    <div className="dlg-head"><div><div className="crumbs">{CL[g.client]!.name} › {b.name} › {g.label}</div><h3>{record ? 'Enter last known record' : `File a ${cat.rtype === 'SVR' ? 'service report' : RTYPES[cat.rtype].toLowerCase()}`}</h3></div><button type="button" className="x" onClick={close} aria-label="Close">×</button></div>
    <div className="dlg-body">
      {record ? <div className="note warn" style={{ margin: 0 }}><span>No record is held. Entering the date of the last known {cat.req.toLowerCase()} lets the next due date be computed. Attach the certificate afterwards.</span></div>
        : <div className="note info" style={{ margin: 0 }}><span><b>{cat.req}</b> · {cat.std} · {s.next ? `was due ${fmt(s.next)}` : 'no previous record'}. Filing this moves the next due date to {cat.months} months after the visit.</span></div>}
      <div className="f-row"><div className="f"><label>{record ? `Date of last ${cat.req.toLowerCase()}` : 'Visit date'}</label><input name="date" type="date" defaultValue={toISO(defaultDate)} max={toISO(TODAY)} required /></div><div className="f"><label>Engineer</label><EngSelect name="eng" trade={cat.trade} sel={g.booking?.eng} /></div></div>
      <div className="f"><label>Result</label><select value={result} onChange={e => { const r = e.target.value as 'pass' | 'fault'; setResult(r); if (!record) setNotes(findings(g.cat, r === 'fault')); }}><option value="pass">Satisfactory — no faults</option><option value="fault">Fault found — raise a remedial</option></select></div>
      <div className="f"><label>Findings</label><textarea name="notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
      {result === 'fault' && <div className="f"><label>Remedial title</label><input name="remtitle" placeholder="What needs doing" /></div>}
      <p className="rowsub" style={{ margin: 0 }}>The report will be numbered in sequence for {b.name} and sent to {CL[g.client]!.contact}.</p>
    </div>
    <div className="dlg-foot"><BtnQ onClick={close}>Cancel</BtnQ><button type="submit" className="btn">{record ? 'Save record' : 'File report'}</button></div>
  </form></Modal>;
}
function ReportSheet({ e, close }: { e: Event; close: () => void }) {
  const g = GR[e.groupId]!; const b = BL[e.building]!; const c = CL[e.client]!; const cat = CATS[e.cat];
  const rems = remedials.filter(r => g.assetIds.includes(r.assetId) && Math.abs(dayDiff(r.raised, e.date)) <= 3);
  return <Modal className="cm-dialog" onClose={close}><div className="doc"><div className="doc-head"><div><div className="kick">{e.type} · Leodis Compliance Management</div><h2>{g.label}</h2><div className="rowsub"><span className="ref">{e.id}</span><span className="sep">/</span>{b.name}<span className="sep">/</span>{fmt(e.date)}</div></div><div className="actions"><BtnQ className="btn-sm" onClick={() => toast(`A PDF of ${e.id} would download here.`)}>Download PDF</BtnQ><button type="button" className="x" onClick={close} aria-label="Close">×</button></div></div>
    <dl className="tb" style={{ margin: '0 0 16px' }}><div><dt>Client</dt><dd>{c.name}</dd></div><div><dt>Engineer</dt><dd>{ENG[e.eng].full}{ENG[e.eng].gasSafe && e.cat === 'GS' && <div className="rowsub">Gas Safe {ENG[e.eng].gasSafe}</div>}</dd></div><div><dt>Requirement</dt><dd>{cat.req}<div className="rowsub">{cat.std}</div></dd></div><div><dt>Result</dt><dd><ResultTag r={e.result} /></dd></div></dl>
    <SecH>Assets covered · {g.assetIds.length}</SecH>
    <div className="rmenu" style={{ maxHeight: 160, overflow: 'auto' }}>{g.assetIds.slice(0, 40).map(id => <a key={id} href={pathTo(AS[id]!)} onClick={close}><span className="ref">{id}</span><div className="rt"><b>{AS[id]!.name}</b><span>{AS[id]!.loc}</span></div></a>)}{g.assetIds.length > 40 && <div className="empty" style={{ padding: 8 }}>and {g.assetIds.length - 40} more</div>}</div>
    <SecH>Findings</SecH><p>{e.notes}</p>
    {rems.length > 0 && <><SecH>Remedials raised</SecH><div className="rmenu">{rems.map(r => <a key={r.id} href={pathTo(AS[r.assetId]!)} onClick={close}><span className="ref">{r.id}</span><div className="rt"><b>{r.title}</b><span>{AS[r.assetId]!.name} · {r.status === 'closed' ? `closed ${fmtS(r.closed)}` : r.owner ? `owner ${engName(r.owner)}` : 'unassigned'}</span></div></a>)}</div></>}
    <SecH>Next due</SecH><p>{cat.req} due again by <b className="num">{fmt(addMonths(e.date, cat.months))}</b>{eventsOf(g)[0] !== e && ' — superseded by a later report'}.</p>
    <div className="sig">Signed {ENG[e.eng].full} · {fmt(e.date)} · Sent to {c.contact} ({c.email}) · Generated by Leodis Relay</div></div></Modal>;
}
function Statement({ scope, close }: { scope: { client?: string; building?: string }; close: () => void }) {
  const b = scope.building ? BL[scope.building]! : null; const c = CL[scope.client ?? b!.client]!;
  const gs = b ? groupsOfBuilding(b.code) : groupsOfClient(c.code); const r = rollup(gs);
  return <Modal className="cm-dialog" onClose={close}><div className="doc"><div className="doc-head"><div><div className="kick">Compliance statement · {b ? 'building' : 'portfolio'} · sample</div><h2>{b ? b.name : c.name}</h2><div className="rowsub">Prepared for {c.contact}, {c.role} · position as at {fmt(TODAY)}</div></div><div className="actions"><BtnQ className="btn-sm" onClick={() => toast('The statement PDF would download here.')}>Download PDF</BtnQ><button type="button" className="x" onClick={close} aria-label="Close">×</button></div></div>
    <p>Of {r.total} tracked assets, <b>{r.ok}</b> are in date, <b>{r.soon}</b> fall due within 30 days, <b>{r.late}</b> are past their statutory date and <b>{r.none}</b> have no record held. This statement summarises the register; it does not replace the individual certificates, which remain the statutory documents.</p>
    <div style={{ margin: '12px 0' }}><Bar c={r} /></div>
    <table className="reg tight" style={{ border: '1px solid var(--line)' }}><thead><tr>{b ? <><th>Requirement</th><th>Last done</th><th>Next due</th><th>Status</th></> : <><th>Building</th><th>Assets</th><th>In date</th><th>Position</th></>}</tr></thead><tbody>
      {b ? gs.map(g => { const s = status(g); return <tr key={g.id}><td>{g.label}<div className="rowsub">{CATS[g.cat].req} · {CATS[g.cat].std}</div></td><td className="due">{fmt(g.last)}</td><td>{s.next ? fmt(s.next) : '—'}</td><td><Tag s={s} /></td></tr>; })
        : buildingsOf(c.code).map(bb => { const rb = rollup(groupsOfBuilding(bb.code)); const l = lateItems().filter(g => g.building === bb.code).length; return <tr key={bb.code}><td>{bb.name}<div className="rowsub">{bb.kind}</div></td><td className="num">{rb.total}</td><td className="num">{Math.round(100 * rb.ok / rb.total)}%</td><td>{l ? <span className="tag tag-alert">{l} overdue</span> : rb.none ? <span className="tag tag-quiet">{rb.none} no record</span> : rb.soon ? <span className="tag tag-caution">{rb.soon} due</span> : <span className="tag tag-ok">In date</span>}</td></tr>; })}</tbody></table>
    <div className="sig">Issued by Cal Say, Compliance manager · Leodis Compliance Management Ltd · {fmt(TODAY)}</div></div></Modal>;
}
