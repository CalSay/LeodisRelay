'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { applyTheme, THEME_KEY } from '@/components/ThemeToggle';
import {
  AS, BL, BUILDINGS, CATS, CL, DAY, ENG, ENGINEERS, GR, MONDAY, SITE, TODAY, addDays, addMonths, addPhoto, closeRemedial, completeVisit, dayDiff, driveMin, engName,
  eventsOf, fmt, fmtS, formFor, groupRems, groupsOfBuilding, intervalWord, isDoneItem, isDraft, longDate, mapsUrl, miles, openRems, plural, progress,
  raiseRemedial, remedials, rollup, sendForm, setAnswer, sign, startVisit, status, toISO, visitById, visits, visitsOn, ensureDraft, drafts, events,
  type Asset, type Building, type EngineerId, type Event, type Field, type Group, type Visit,
} from '@/lib/compliance/model';
import { Bar, Modal, ResultTag, Tag, Toasts, formValues, parseHash, toast, useHashRoute, useModel, useMounted } from './shared';

type Sheet = { kind: 'raise'; assetId?: string; building?: string } | { kind: 'report'; e: Event };
interface Ctx { me: EngineerId; go: (h: string) => void; back: () => void; setSheet: (s: Sheet | null) => void; openAccess: boolean; setOpenAccess: (b: boolean) => void }
const SecH = ({ children, cnt }: { children: ReactNode; cnt?: ReactNode }) => <div className="sec-h">{children}{cnt !== undefined && <span className="cnt">{cnt}</span>}</div>;
const VStatus = ({ v }: { v: Visit }) => v.status === 'done' ? <span className="tag tag-ok">Done</span> : v.status === 'onsite' ? <span className="tag tag-aqua">On site</span> : dayDiff(v.date, TODAY) === 0 ? <span className="tag tag-gold">Today</span> : <span className="tag tag-quiet">Planned</span>;
const Travel = ({ prev, code }: { prev: string | null; code: string }) => { const min = driveMin(prev, code); return <span className="travel">🚐 {min} min · {miles(min)} mi from {prev ? BL[prev]!.name.split(' —')[0] : 'the depot'}</span>; };

export function EngineerMobile({ userName, initialEngineer, canSwitch }: { userName: string; initialEngineer: EngineerId; canSwitch: boolean }) {
  useModel();
  const mounted = useMounted();
  const { hash, go, back } = useHashRoute('#/today');
  const [me, setMe] = useState<EngineerId>(initialEngineer);
  const [weekDay, setWeekDay] = useState<Date>(TODAY);
  const [openAccess, setOpenAccess] = useState(false);
  const [bSearch, setBSearch] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const parts = parseHash(hash); const screen = parts[0] ?? 'today'; const a = parts[1] ?? null; const b = parts[2] ?? null;
  useEffect(() => { setOpenAccess(false); }, [hash]);
  if (!mounted) return <div className="cm cm-loading">Loading</div>;
  const ctx: Ctx = { me, go, back, setSheet, openAccess, setOpenAccess };
  const onRootClick = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest('a[href^="#/"]'); if (el && !e.ctrlKey && !e.metaKey) { e.preventDefault(); go(el.getAttribute('href')!); } };
  const visit = screen === 'visit' && a ? visitById(a) : undefined;
  let body: ReactNode;
  if (screen === 'form' && b && GR[b]) body = <FormScreen ctx={ctx} v={a && a !== '-' ? visitById(a) ?? null : null} g={GR[b]!} />;
  else if (visit) body = <VisitScreen ctx={ctx} v={visit} />;
  else if (screen === 'building' && a && BL[a]) body = <BuildingScreen ctx={ctx} b={BL[a]!} q={bSearch} setQ={setBSearch} />;
  else if (screen === 'asset' && a && AS[a]) body = <AssetScreen ctx={ctx} a={AS[a]!} />;
  else if (screen === 'week') body = <WeekScreen ctx={ctx} weekDay={weekDay} setWeekDay={setWeekDay} />;
  else if (screen === 'buildings') body = <BuildingsScreen ctx={ctx} />;
  else if (screen === 'me') body = <MeScreen ctx={ctx} userName={userName} canSwitch={canSwitch} setMe={id => { setMe(id); toast(`Viewing as ${ENG[id].full}.`); go('#/today'); }} />;
  else body = <TodayScreen ctx={ctx} />;
  const tab = screen === 'visit' && visit ? (dayDiff(visit.date, TODAY) === 0 ? 'today' : 'week') : (screen === 'building' || screen === 'asset' || screen === 'form') ? 'today' : screen;
  const todo = visitsOn(me, TODAY).filter(v => v.status !== 'done').length;
  return <div className="cm cm-mobile" onClick={onRootClick}><div className="cm-stage"><div className="cm-phone">
    {body}
    <nav className="tabbar">{([['today', 'Today', '◉', todo], ['week', 'Diary', '▦', 0], ['buildings', 'Buildings', '⌂', 0], ['me', 'Me', '◯', 0]] as const).map(([k, l, ic, n]) => <a key={k} className={tab === k ? 'on' : ''} href={`#/${k}`}><i>{ic}</i>{l}{n > 0 && <b>{n}</b>}</a>)}</nav>
    {sheet && <Sheets s={sheet} ctx={ctx} close={() => setSheet(null)} />}
    <Toasts />
  </div><p className="caption">Relay · Leodis Compliance · engineer view · sample data</p></div></div>;
}

function ThemeBtn() { return <button type="button" className="iconbtn" aria-label="Appearance" onClick={() => { const root = document.documentElement; const cur = root.getAttribute('data-theme') ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); try { window.localStorage.setItem(THEME_KEY, next); } catch { /* fine */ } }}>◐</button>; }
function AppBar({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: (() => void) | undefined; right?: ReactNode }) {
  return <header className="appbar">{back ? <button type="button" className="iconbtn" onClick={back} aria-label="Back">‹</button> : <div className="brandm"><b>RELAY</b><span>COMPLIANCE</span></div>}<div className="abt"><b>{title}</b>{sub && <span>{sub}</span>}</div>{right}</header>;
}
function VisitCard({ ctx, v, prev, compact }: { ctx: Ctx; v: Visit; prev: string | null; compact?: boolean }) {
  const b = BL[v.building]!; const s = SITE[v.building]!; const items = v.items.map(g => GR[g]!);
  const next = !compact && v.status === 'planned' && dayDiff(v.date, TODAY) === 0 && visitsOn(ctx.me, v.date).filter(x => x.status !== 'done')[0] === v;
  return <a className={`vcard ${v.status} ${next ? 'next' : ''}`} href={`#/visit/${v.id}`}>
    <div className="vtime"><b>{v.time}</b>{v.status === 'done' ? <span>–{v.finished}</span> : v.status === 'onsite' ? <span>since {v.started}</span> : null}</div>
    <div className="vbody"><div className="vhead"><b>{b.name}</b><VStatus v={v} /></div><div className="vsub">{CL[b.client]!.name} · {s.addr.split(',').slice(-2).join(',').trim()}</div>
      <div className="vitems">{items.slice(0, 3).map(g => <span key={g.id} className={`vi ${isDoneItem(v, g.id) ? 'did' : isDraft(g) ? 'draft' : status(g).key}`}>{g.label}</span>)}{items.length > 3 && <span className="vi">+{items.length - 3}</span>}</div>
      {!compact && <div className="vfoot"><Travel prev={prev} code={v.building} />{v.status === 'done' && <span className="travel">{plural(v.filed.length, 'report')} filed</span>}</div>}</div></a>;
}
function TodayScreen({ ctx }: { ctx: Ctx }) {
  const list = visitsOn(ctx.me, TODAY); const todo = list.filter(v => v.status !== 'done'); const onsite = list.find(v => v.status === 'onsite');
  const drive = list.reduce((n, v, i) => n + driveMin(i ? list[i - 1]!.building : null, v.building), 0);
  return <><AppBar title="Today" sub={`${longDate(TODAY)} · ${ENG[ctx.me].name}`} right={<ThemeBtn />} /><main className="screen">
    <dl className="sum"><div><dt>Visits</dt><dd>{list.length}</dd></div><div><dt>To go</dt><dd>{todo.length}</dd></div><div><dt>Items</dt><dd>{list.reduce((n, v) => n + v.items.length, 0)}</dd></div><div><dt>Drive</dt><dd>{drive}<small>min</small></dd></div></dl>
    {onsite && <div className="note info"><span><b>You are on site at {BL[onsite.building]!.name.split(' —')[0]}</b> since {onsite.started}. {onsite.items.filter(g => !isDoneItem(onsite, g)).length} of {onsite.items.length} items still to file{onsite.items.filter(g => !isDoneItem(onsite, g) && isDraft(GR[g]!)).length > 0 && ` (${onsite.items.filter(g => !isDoneItem(onsite, g) && isDraft(GR[g]!)).length} in draft)`}.</span></div>}
    <SecH>Your day</SecH>
    <div className="vlist">{list.length ? list.map((v, i) => <VisitCard key={v.id} ctx={ctx} v={v} prev={i ? list[i - 1]!.building : null} />) : <div className="empty">Nothing booked today.</div>}</div>
    <SecH>Tomorrow</SecH>
    <div className="vlist">{visitsOn(ctx.me, addDays(TODAY, 1)).map(v => <VisitCard key={v.id} ctx={ctx} v={v} prev={null} compact />)}{visitsOn(ctx.me, addDays(TODAY, 1)).length === 0 && <div className="empty">Nothing booked.</div>}</div>
    <p className="fine-print">Drafts and photos stay on this phone until you send them. The office sees that a visit has started, not what you have written.</p>
  </main></>;
}
function WeekScreen({ ctx, weekDay, setWeekDay }: { ctx: Ctx; weekDay: Date; setWeekDay: (d: Date) => void }) {
  const start = addDays(MONDAY, Math.floor(dayDiff(weekDay, MONDAY) / 7) * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)); const list = visitsOn(ctx.me, weekDay);
  const stops = ['Depot', ...list.map(v => BL[v.building]!.name.split(' —')[0]!), 'Depot'];
  return <><AppBar title="Diary" sub={`w/c ${fmtS(start)} · ${ENG[ctx.me].name}`} right={<div className="wknav"><button type="button" className="iconbtn" onClick={() => setWeekDay(addDays(weekDay, -7))} aria-label="Previous week">‹</button><button type="button" className="iconbtn" onClick={() => setWeekDay(addDays(weekDay, 7))} aria-label="Next week">›</button></div>} /><main className="screen">
    <div className="days">{days.map(d => { const n = visitsOn(ctx.me, d).length; return <button type="button" key={toISO(d)} className={`day ${dayDiff(d, weekDay) === 0 ? 'on' : ''} ${dayDiff(d, TODAY) === 0 ? 'today' : ''}`} onClick={() => setWeekDay(d)}><span>{DAY[d.getDay()]}</span><b>{d.getDate()}</b><i>{n ? '●'.repeat(Math.min(n, 3)) : ''}</i></button>; })}</div>
    <SecH>{longDate(weekDay)}{dayDiff(weekDay, TODAY) === 0 && ' · today'}</SecH>
    <div className="vlist">{list.length ? list.map((v, i) => <VisitCard key={v.id} ctx={ctx} v={v} prev={i ? list[i - 1]!.building : null} />) : <div className="empty">Nothing booked this day.</div>}</div>
    {list.length > 1 && <><SecH>Route</SecH><div className="route">{stops.map((n, i) => <div key={i} className="rstop"><i /><b>{n}</b>{i < stops.length - 1 && <span>{driveMin(i === 0 ? null : list[i - 1]!.building, i === stops.length - 2 ? 'HDP' : list[i]!.building)} min</span>}</div>)}</div></>}
  </main></>;
}
function VisitScreen({ ctx, v }: { ctx: Ctx; v: Visit }) {
  const b = BL[v.building]!; const s = SITE[v.building]!; const c = CL[b.client]!;
  const dayList = visitsOn(v.eng, v.date); const idx = dayList.indexOf(v); const prev = idx > 0 ? dayList[idx - 1]!.building : null; const min = driveMin(prev, v.building);
  const items = v.items.map(g => GR[g]!); const left = items.filter(g => !isDoneItem(v, g.id));
  const rems = remedials.filter(r => r.status === 'open' && AS[r.assetId]!.building === v.building);
  return <><AppBar title={b.name} sub={`${c.name} · ${fmtS(v.date)} ${v.time}`} back={ctx.back} right={<VStatus v={v} />} /><main className="screen">
    {v.note && <div className="note warn"><span>{v.note}</span></div>}
    <div className="btnrow">
      <a className="bigbtn" href={mapsUrl(v.building)} target="_blank" rel="noopener noreferrer"><b>Directions</b><span>{min} min · {miles(min)} mi</span></a>
      <a className="bigbtn" href={`tel:${s.phone.replace(/\s/g, '')}`}><b>Call site</b><span>{b.rp.split(': ')[1] ?? c.contact}</span></a>
      <button type="button" className="bigbtn" onClick={() => ctx.setOpenAccess(!ctx.openAccess)}><b>Access</b><span>{ctx.openAccess ? 'hide' : 'keys, parking'}</span></button>
    </div>
    <div className="addr">{s.addr}</div>
    {ctx.openAccess && <dl className="access"><div><dt>Parking</dt><dd>{s.parking}</dd></div><div><dt>On arrival</dt><dd>{s.access}</dd></div><div><dt>Finding the plant</dt><dd>{s.route}</dd></div><div><dt>Hours</dt><dd>{s.hours}</dd></div><div><dt>Duty holder</dt><dd>{b.rp} · {s.phone}</dd></div></dl>}
    <SecH cnt={`${items.length - left.length}/${items.length} filed`}>Work at this visit</SecH>
    <div className="ilist">{items.map(g => { const st = status(g); const done = isDoneItem(v, g.id); const first = AS[g.assetIds[0]!]!; return <div key={g.id} className={`irow ${done ? 'did' : ''}`}>
      <a className="imain" href={`#/asset/${first.id}`}><b>{g.label}</b><span>{CATS[g.cat].req} · {first.loc}{g.assetIds.length === 1 && ` · ${first.make}`}</span><span className="istat">{done ? <span className="tag tag-ok">Filed</span> : isDraft(g) ? <span className="tag tag-gold">Draft {progress(g).pct}%</span> : <Tag s={st} word={st.key === 'late' ? `Overdue ${-(st.days ?? 0)}d` : st.key === 'soon' ? `Due ${fmtS(st.next)}` : st.word} />}{groupRems(g).length > 0 && <span className="tag tag-caution">{groupRems(g).length} remedial</span>}</span></a>
      {!done && v.status === 'onsite' && (isDraft(g) ? <button type="button" className="btn btn-q" onClick={() => ctx.go(`#/form/${v.id}/${g.id}`)}>Continue · {progress(g).pct}%</button> : <button type="button" className="btn" onClick={() => ctx.go(`#/form/${v.id}/${g.id}`)}>Start form</button>)}</div>; })}</div>
    {rems.length > 0 && <><SecH>Open remedials here</SecH><div className="ilist">{rems.map(r => <a key={r.id} className="irow" href={`#/asset/${r.assetId}`}><span className="imain"><b>{r.title}</b><span>{r.id} · {AS[r.assetId]!.name} · {r.owner === ctx.me ? 'yours' : r.owner ? engName(r.owner) : 'unassigned'} · target {fmtS(r.target)}</span></span></a>)}</div></>}
    <SecH>Building</SecH>
    <a className="irow" href={`#/building/${v.building}`}><span className="imain"><b>All assets at {b.name.split(' —')[0]}</b><span>{groupsOfBuilding(v.building).reduce((n, g) => n + g.assetIds.length, 0)} tracked · {b.kind}</span></span><span className="chev">›</span></a>
    <div className="stick">{v.status === 'planned' ? <button type="button" className="btn wide" onClick={() => { startVisit(v); toast(`Visit started. The office can see you are at ${b.name.split(' —')[0]}.`); }}>Start visit</button>
      : v.status === 'onsite' ? <button type="button" className={`btn wide ${left.length ? 'btn-q' : ''}`} onClick={() => { completeVisit(v); toast(`Visit complete. ${plural(v.filed.length, 'report')} sent to ${c.contact}.`); ctx.go('#/today'); }}>{left.length ? `Complete with ${plural(left.length, 'item')} unfiled` : 'Complete visit'}</button>
      : <div className="donebar">Completed {v.finished} · {plural(v.filed.length, 'report')} sent to {c.contact}</div>}
      {v.status !== 'done' && <button type="button" className="btn btn-q wide" onClick={() => ctx.setSheet({ kind: 'raise', building: v.building })}>Raise a remedial</button>}</div>
  </main></>;
}
function BuildingScreen({ ctx, b, q, setQ }: { ctx: Ctx; b: Building; q: string; setQ: (s: string) => void }) {
  const gs = groupsOfBuilding(b.code); const r = rollup(gs); const ql = q.trim().toLowerCase();
  const all = gs.flatMap(g => g.assetIds.map(id => AS[id]!)).filter(a => !ql || `${a.id} ${a.name} ${a.make} ${a.loc} ${CATS[a.cat].label}`.toLowerCase().includes(ql));
  const cats = [...new Set(all.map(a => a.cat))];
  return <><AppBar title={b.name} sub={`${b.kind} · ${r.total} assets`} back={ctx.back} /><main className="screen">
    <div className="searchm"><input type="search" placeholder="Find an asset, tag, make or location" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" aria-label="Find an asset" /></div>
    <div style={{ padding: '0 16px' }}><Bar c={r} /><div className="meta" style={{ marginTop: 6 }}><span>{r.ok} in date</span><span className="soon">{r.soon} due</span><span className="late">{r.late} overdue</span><span>{r.none} no record</span></div></div>
    {cats.length ? cats.map(cat => <div key={cat}><SecH cnt={all.filter(a => a.cat === cat).length}>{CATS[cat].label}</SecH><div className="ilist">{all.filter(a => a.cat === cat).map(a => <a key={a.id} className="irow" href={`#/asset/${a.id}`}><span className="imain"><b>{a.name}</b><span><span className="ref" style={{ fontSize: 11 }}>{a.id}</span> · {a.loc}</span></span>{openRems(a).length ? <span className="tag tag-caution">Remedial</span> : <Tag s={status(GR[a.groupId]!)} />}</a>)}</div></div>) : <div className="empty">Nothing matches.</div>}
  </main></>;
}
function AssetScreen({ ctx, a }: { ctx: Ctx; a: Asset }) {
  const g = GR[a.groupId]!; const b = BL[a.building]!; const cat = CATS[a.cat]; const st = status(g); const hist = eventsOf(g).slice(0, 4); const rems = openRems(a);
  const todayVisit = visitsOn(ctx.me, TODAY).find(v => v.items.includes(g.id) && v.status === 'onsite');
  return <><AppBar title={a.name} sub={<><span className="ref" style={{ fontSize: 11 }}>{a.id}</span> · {b.name.split(' —')[0]}</>} back={ctx.back} /><main className="screen">
    <dl className="kv"><div><dt>Where</dt><dd>{a.loc}</dd></div><div><dt>Make</dt><dd>{a.make}</dd></div>{a.serial && <div><dt>Serial</dt><dd className="num">{a.serial}</dd></div>}{a.installed && <div><dt>Installed</dt><dd>{fmt(a.installed)}{a.warrantyEnd && ` · warranty to ${fmt(a.warrantyEnd)}`}</dd></div>}</dl>
    <dl className="duem"><div><dt>{cat.req}</dt><dd className="txt">{cat.std} · {intervalWord(cat.months)}</dd></div><div><dt>Last</dt><dd>{g.last ? `${fmtS(g.last)} ${g.last.getFullYear()}` : <span className="fine">none</span>}</dd></div><div><dt>Next</dt><dd className={st.key}>{st.next ? `${fmtS(st.next)} ${st.next.getFullYear()}` : 'not known'}<small>{st.key === 'late' ? `${-(st.days ?? 0)} days overdue` : st.key === 'soon' ? `${st.days} days` : st.key === 'none' ? 'no record' : 'in date'}</small></dd></div></dl>
    {g.assetIds.length > 1 && <div className="note info"><span>One of {g.assetIds.length} {cat.unit}s checked together. Filing covers the whole set.</span></div>}
    {rems.length > 0 && <><SecH>Open remedials</SecH><div className="ilist">{rems.map(r => <div key={r.id} className="irow"><span className="imain"><b>{r.title}</b><span>{r.id} · raised {fmtS(r.raised)} · {r.owner ? engName(r.owner) : 'unassigned'} · target {fmtS(r.target)}</span></span>{(r.owner === ctx.me || !r.owner) && <button type="button" className="btn btn-q" onClick={() => { closeRemedial(r, ctx.me); toast(`${r.id} closed by ${ENG[ctx.me].name}.`); }}>Close</button>}</div>)}</div></>}
    <SecH>History</SecH>
    <div className="ilist">{hist.length ? hist.map(e => <button type="button" key={e.id} className="irow" onClick={() => ctx.setSheet({ kind: 'report', e })}><span className="imain"><b>{fmt(e.date)} · {engName(e.eng)}</b><span>{e.id} · {e.notes.length > 90 ? `${e.notes.slice(0, 88)}…` : e.notes}</span></span><ResultTag r={e.result} /></button>) : <div className="empty">No reports on file.</div>}</div>
    <div className="stick">{todayVisit && !isDoneItem(todayVisit, g.id) ? <button type="button" className="btn wide" onClick={() => ctx.go(`#/form/${todayVisit.id}/${g.id}`)}>{isDraft(g) ? `Continue form · ${progress(g).pct}%` : `Open ${formFor(g).title.toLowerCase()} form`}</button> : <button type="button" className="btn btn-q wide" onClick={() => ctx.go(`#/form/-/${g.id}`)}>{isDraft(g) ? `Continue draft · ${progress(g).pct}%` : 'Open service form'}</button>}
      <button type="button" className="btn btn-q wide" onClick={() => ctx.setSheet({ kind: 'raise', assetId: a.id })}>Raise a remedial</button></div>
  </main></>;
}
function BuildingsScreen({ ctx }: { ctx: Ctx }) {
  const mine = [...new Set(visits.filter(v => v.eng === ctx.me && v.date >= addDays(TODAY, -7)).map(v => v.building))]; const rest = BUILDINGS.map(b => b.code).filter(c => !mine.includes(c));
  const Row = ({ code }: { code: string }) => { const b = BL[code]!; const r = rollup(groupsOfBuilding(code)); const nv = visits.find(v => v.eng === ctx.me && v.building === code && v.status !== 'done'); return <a className="irow" href={`#/building/${code}`}><span className="imain"><b>{b.name}</b><span>{SITE[code]!.addr.split(',').slice(-2).join(',').trim()}{nv && ` · next visit ${fmtS(nv.date)}`}</span><span style={{ display: 'block', marginTop: 6 }}><Bar c={r} /></span></span><span className="chev">›</span></a>; };
  return <><AppBar title="Buildings" sub={`${BUILDINGS.length} on the register`} /><main className="screen">
    <SecH>Yours this fortnight</SecH><div className="ilist">{mine.length ? mine.map(c => <Row key={c} code={c} />) : <div className="empty">No visits assigned.</div>}</div>
    <SecH>Everything else</SecH><div className="ilist">{rest.map(c => <Row key={c} code={c} />)}</div></main></>;
}
function MeScreen({ ctx, userName, canSwitch, setMe }: { ctx: Ctx; userName: string; canSwitch: boolean; setMe: (id: EngineerId) => void }) {
  const e = ENG[ctx.me]; const week = visits.filter(v => v.eng === ctx.me && v.date >= MONDAY && v.date < addDays(MONDAY, 7)); const done = week.filter(v => v.status === 'done');
  const filed = events.filter(x => x.eng === ctx.me && x.date >= MONDAY).length; const rems = remedials.filter(r => r.status === 'open' && r.owner === ctx.me);
  return <><AppBar title={e.full} sub={`${e.role ?? 'Engineer'} · signed in as ${userName}`} right={<ThemeBtn />} /><main className="screen">
    <dl className="sum"><div><dt>Visits</dt><dd>{done.length}<small>/{week.length}</small></dd></div><div><dt>Filed</dt><dd>{filed}</dd></div><div><dt>Remedials</dt><dd>{rems.length}</dd></div><div><dt>Queued</dt><dd>0</dd></div></dl>
    <dl className="kv"><div><dt>Trades</dt><dd>{e.trades.join(' · ')}</dd></div>{e.gasSafe && <div><dt>Gas Safe</dt><dd className="num">{e.gasSafe}</dd></div>}<div><dt>Sync</dt><dd>Sample data · nothing is saved between visits to this page</dd></div></dl>
    <SecH>Your remedials</SecH>
    <div className="ilist">{rems.length ? rems.map(r => <a key={r.id} className="irow" href={`#/asset/${r.assetId}`}><span className="imain"><b>{r.title}</b><span>{BL[AS[r.assetId]!.building]!.name} · target {fmtS(r.target)}</span></span><span className={`tag ${dayDiff(r.target, TODAY) < 0 ? 'tag-alert' : 'tag-caution'}`}>{dayDiff(r.target, TODAY) < 0 ? 'Past target' : 'Open'}</span></a>) : <div className="empty">None assigned to you.</div>}</div>
    {canSwitch && <><SecH>View as</SecH><div className="f" style={{ padding: '0 16px' }}><label htmlFor="cm-viewas">Sample engineer</label><select id="cm-viewas" value={ctx.me} onChange={ev => setMe(ev.target.value as EngineerId)}>{ENGINEERS.map(x => <option key={x.id} value={x.id}>{x.full} — {x.trades.slice(0, 2).join(', ')}</option>)}</select></div></>}
    <div className="ilist" style={{ marginTop: 16 }}>
      <Link className="irow" href="/"><span className="imain"><b>Companies</b><span>Back to the company hub</span></span><span className="chev">›</span></Link>
      <form action="/api/auth/signout" method="POST" style={{ display: 'contents' }}><button type="submit" className="irow"><span className="imain"><b>Sign out</b><span>{userName}</span></span><span className="chev">›</span></button></form>
    </div>
    <p className="fine-print">Everything here is invented. Addresses are real streets with made-up buildings; phone numbers are 0113 496 test numbers. Nothing on this screen is a real compliance record.</p>
  </main></>;
}
function FormScreen({ ctx, v, g }: { ctx: Ctx; v: Visit | null; g: Group }) {
  const b = BL[g.building]!; const cat = CATS[g.cat]; const form = formFor(g); const d = drafts[g.id] ?? ensureDraft(g); const p = progress(g);
  const first = AS[g.assetIds[0]!]!;
  const field = (f: Field) => {
    const val = d.a[f.id];
    const seg = (opts: { v: string; l: string; c?: string }[]) => <div className={`seg s${opts.length}`}>{opts.map(o => <label key={o.v}><input type="radio" name={f.id} value={o.v} checked={val === o.v} onChange={() => setAnswer(g, f.id, o.v)} /><span className={o.c ?? ''}>{o.l}</span></label>)}</div>;
    let ctl: ReactNode;
    if (f.t === 'check') ctl = seg([{ v: 'pass', l: 'Pass', c: 'okc' }, { v: 'fail', l: 'Fail', c: 'late' }, { v: 'na', l: 'N/A', c: 'fine' }]);
    else if (f.t === 'yn') ctl = seg([{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]);
    else if (f.t === 'num') ctl = <div className="numf"><input type="number" inputMode="decimal" step="any" value={val ?? ''} placeholder="—" onChange={e => setAnswer(g, f.id, e.target.value)} />{f.unit && <span>{f.unit}</span>}</div>;
    else if (f.t === 'time') ctl = <input type="time" value={val ?? ''} onChange={e => setAnswer(g, f.id, e.target.value)} />;
    else if (f.t === 'choice') ctl = <select value={val ?? ''} onChange={e => setAnswer(g, f.id, e.target.value)}><option value="">Select…</option>{f.opts!.map(o => <option key={o}>{o}</option>)}</select>;
    else ctl = <textarea value={val ?? ''} placeholder="Optional" onChange={e => setAnswer(g, f.id, e.target.value)} />;
    return <div key={f.id} className={`ff ${f.req ? 'req' : ''}`}><label>{f.label}{!f.req && <em>optional</em>}</label>{ctl}</div>;
  };
  const send = () => { const out = sendForm(g, ctx.me, v); toast(out.remedial ? `Sent ${out.event.id} with a fault. ${out.remedial.id} raised for the office to assign.` : `Sent ${out.event.id} · next ${cat.req.toLowerCase()} due ${fmt(addMonths(TODAY, cat.months))}.`); ctx.go(v ? `#/visit/${v.id}` : `#/asset/${first.id}`); };
  return <><AppBar title={form.title} sub={`${g.label} · ${b.name.split(' —')[0]}`} back={ctx.back} right={<span className="tag tag-gold">Draft</span>} /><main className="screen">
    <div className="note warn"><span><b>Placeholder form.</b> Sections and fields are a first draft against {cat.std}. Leodis&apos;s actual {form.title.toLowerCase()} form replaces this.</span></div>
    <dl className="kv" style={{ marginTop: 12 }}><div><dt>Covers</dt><dd>{g.assetIds.length > 1 ? `${g.assetIds.length} ${cat.unit}s · ${first.loc} and others` : `${first.name} · ${first.make} · ${first.loc}`}</dd></div><div><dt>Started</dt><dd>{d.started} · {ENG[ctx.me].full}{v && ` · visit ${v.id}`}</dd></div></dl>
    {form.sections.map((s, i) => <div key={s.h}><SecH>{i + 1}. {s.h}</SecH><div className="fsec">{s.f.map(field)}</div></div>)}
    <SecH>{form.sections.length + 1}. Evidence</SecH>
    <div className="fsec"><div className="ff"><label>Photos</label><div className="photos"><button type="button" className="ph" onClick={() => addPhoto(g)}>＋<span>Add</span></button>{Array.from({ length: d.photos }, (_, i) => <span key={i} className="ph thumb">IMG {i + 1}</span>)}</div></div>
      <div className="ff req"><label>Signature</label>{d.signed ? <div className="sig-line signed">✓ Signed {ENG[ctx.me].full} · {fmt(TODAY)} · on site</div> : <button type="button" className="btn btn-q wide" onClick={() => sign(g)}>Sign as {ENG[ctx.me].full}</button>}</div></div>
    <div className="stick fstick">
      <div className="prog"><div className="progbar"><i style={{ width: `${p.pct}%` }} /></div><span>{p.done} of {p.total} required answered{p.signed ? ' · signed' : ' · not signed'}</span></div>
      <div className="btnpair"><button type="button" className="btn btn-q" onClick={() => { toast('Draft saved on this phone. It is not sent until you send it.'); ctx.go(v ? `#/visit/${v.id}` : `#/asset/${first.id}`); }}>Save draft</button><button type="button" className="btn" disabled={p.done < p.total || !p.signed} onClick={send}>Send report</button></div>
    </div>
  </main></>;
}
function Sheets({ s, ctx, close }: { s: Sheet; ctx: Ctx; close: () => void }) {
  if (s.kind === 'report') {
    const e = s.e; const g = GR[e.groupId]!;
    return <Modal className="cm-sheet" onClose={close}><div className="sh-head"><b>{e.type}</b><span>{e.id} · {fmt(e.date)}</span><button type="button" className="iconbtn" onClick={close} aria-label="Close">×</button></div>
      <div className="sh-body"><dl className="kv" style={{ margin: 0 }}><div><dt>Covers</dt><dd>{g.label} · {BL[e.building]!.name}</dd></div><div><dt>Engineer</dt><dd>{ENG[e.eng].full}</dd></div><div><dt>Result</dt><dd><ResultTag r={e.result} /></dd></div></dl><p style={{ margin: '12px 0 0', fontSize: 14 }}>{e.notes}</p><p className="fine-print" style={{ padding: '8px 0 0', margin: 0 }}>Next {CATS[e.cat].req.toLowerCase()} due {fmt(addMonths(e.date, CATS[e.cat].months))}.</p></div></Modal>;
  }
  const opts = s.assetId ? [AS[s.assetId]!] : groupsOfBuilding(s.building!).map(g => AS[g.assetIds[0]!]!);
  const bname = BL[s.assetId ? AS[s.assetId]!.building : s.building!]!.name;
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const vals = formValues(e.currentTarget); const a = AS[vals.asset!]!; const r = raiseRemedial(a.id, vals.title!, null, addDays(TODAY, 28)); toast(`${r.id} raised against ${a.name}. The office will assign it.`); close(); };
  return <Modal className="cm-sheet" onClose={close}><form onSubmit={submit}><div className="sh-head"><b>Raise a remedial</b><span>{bname}</span><button type="button" className="iconbtn" onClick={close} aria-label="Close">×</button></div>
    <div className="sh-body"><div className="f"><label>Asset</label><select name="asset" defaultValue={opts[0]!.id}>{opts.map(a => <option key={a.id} value={a.id}>{GR[a.groupId]!.label} · {a.id}</option>)}</select></div>
      <div className="f"><label>What needs doing</label><input name="title" required placeholder="Short, so the office can quote it" /></div>
      <p className="fine-print" style={{ margin: 0 }}>Raised against the asset with a 28-day target. The office assigns it; photos can be added to the visit report.</p></div>
    <div className="sh-foot"><button type="submit" className="btn wide">Raise</button></div></form></Modal>;
}
