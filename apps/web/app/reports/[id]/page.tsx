"use client";
import { useProjectLookup } from "@/components/ProjectContext";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getReport,
  newObservation,
  openIssues as fetchOpenIssues,
  projectLocations,
  reviewReport,
  saveReport,
  submitReport,
  type Observation,
  type Report,
} from "@/lib/api";
import { ApiError, SaveConflict } from "@/lib/api";
import { clientId } from '@/lib/clientId';
import { dropAside, hasUnsent, keep, recover, releaseIfCurrent, setAside } from "@/lib/localDraft";
import { KindPicker, ObservationEditor } from "@/components/ObservationEditor";
import { SignaturePad } from "@/components/SignaturePad";
import type { Issue as IssueSummary } from "@/lib/types";
import { usePrincipal } from '@/components/PrincipalContext';
import { useRouter } from 'next/navigation';
import { correctReport as requestCorrection } from '@/lib/api';
import { ownsReport } from '@/lib/auth/access';
import { toneClass } from '@/lib/status';
import { SubmissionStages } from '@/components/SubmissionStages';
import { OBSERVATION_TYPES, type ObservationType } from '@/lib/fixtures';
import { safeViewReturn, withViewReturn } from '@/lib/viewNavigation';
import { cardAtSameLocation, insertAfterSameLocation } from '@/lib/sameLocation';
import { onPhotoUploads, uploadingPhotos } from '@/lib/localMedia';
import { cardWhere, reportWhere, savedCopy, WHERE, type Where } from '@/lib/uploadStatus';
import { compareDrafts, type DraftBase } from '@/lib/draftConflict';
import { DraftConflict } from '@/components/DraftConflict';
import { renewTabId, tabId } from '@/lib/tabId';

type SaveState = "clean" | "saving" | "saved" | "phone" | "unheld" | "error" | "conflict";

/**
 * Where the work is, said plainly.
 *
 * "On this phone only" is deliberately not a success state and does not get the
 * green dot. Proposal section 5 is explicit that a tick for a local save must
 * not suggest the work is safely with Leodis, and the whole point of separating
 * these states is that an engineer can tell at a glance which one they are in.
 */
const SAVE: Record<SaveState, { dot: string; text: string }> = {
  clean: { dot: "dot", text: "" },
  saving: { dot: "dot dot-busy", text: "Saving to server" },
  saved: { dot: "dot dot-ok", text: "Saved on server" },
  phone: { dot: "dot dot-busy", text: "On this device only — will retry saving when connected" },
  // The dangerous state, and the only one that warrants alarm: the work is
  // neither on the server nor held on the device, so closing the page loses it.
  unheld: { dot: "dot dot-bad", text: "NOT SAVED ANYWHERE — keep this page open" },
  error: { dot: "dot dot-bad", text: "Not saved — check connection" },
  conflict: { dot: "dot dot-bad", text: "Saved elsewhere too — choose what to keep" },
};

/** The dot beside a card or photograph: green only when the server has it. */
const WHERE_DOT: Record<Where, string> = { server: 'dot dot-ok', uploading: 'dot dot-busy', pending: 'dot dot-busy', phone: 'dot dot-busy' };
/** Tabs on one device tell each other when they save a draft, so the other can catch up or say so at once. */
const CHANNEL = 'relay-drafts';
/** While the server cannot be reached, try again this often; coming back into signal also retries. */
const RETRY_MS = 15_000;

const KINDS: ObservationType[] = ['update', 'defect', 'instruction', 'access'];
const fmtWhen = (iso?: string) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const getProject = useProjectLookup();
  const { id } = use(params);
  const returnTo = use(searchParams).returnTo;
  const principal = usePrincipal();
  const router = useRouter();
  const [selectedSection,setSelectedSection] = useState<string | null>(null);
  /** Cards added this session whose kind has not been chosen yet: they show the picker, not the form. */
  const [picking,setPicking] = useState<string[]>([]);
  const [correcting,setCorrecting] = useState(false);
  const [correctionReason,setCorrectionReason] = useState('');
  const [correctionError,setCorrectionError] = useState('');
  const [locations,setLocations] = useState<string[]>([]);

  const [report, setReport] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [projectIssues, setProjectIssues] = useState<IssueSummary[]>([]);
  const [signerName, setSignerName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  /** The draft as the server last accepted it, so every card can say whether it is on the server. */
  const [onServer, setOnServer] = useState<OnServer>({ cards: {} });
  /** The same, for code running outside a render: the base a conflict is judged against. */
  const onServerRef = useRef<OnServer>({ cards: {} });
  useEffect(() => { onServerRef.current = onServer; }, [onServer]);
  /** The base stored with work set aside before a reload, which the fresh server copy cannot stand in for. */
  const restoredBase = useRef<DraftBase | undefined>(undefined);
  const [uploading, setUploading] = useState<ReadonlySet<string>>(() => new Set());

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Report | null>(null);
  /** Who is signed in, for scoping work held on this device. */
  const [principalId, setPrincipalId] = useState<string | null>(null);
  /**
   * Every edit gets a number. It identifies which copy is held on the device,
   * so a save that lands late releases only the edit it actually saved.
   */
  const seq = useRef<number | string>(0);
  /**
   * Saves run one at a time along this chain. Debouncing alone left two
   * requests in flight whenever somebody kept typing, and the earlier one could
   * land last and win.
   */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /**
   * The report as it currently stands, for retries that did not originate from
   * an edit. Recovered work is the case that matters: after a reload there is
   * nothing pending, so without this a report restored from the device would
   * sit there until somebody happened to type — which is precisely the moment
   * an engineer assumes it has gone.
   */
  const latest = useRef<Report | null>(null);
  const serverVersion = useRef<number | undefined>(undefined);
  const sending = useRef(false);
  /**
   * The draft as another tab or device saved it, while this screen holds
   * different work. Saving pauses until the engineer chooses what to keep.
   */
  const [conflict,setConflict] = useState<Report | null>(null);
  const [conflictBase,setConflictBase] = useState<DraftBase | undefined>(undefined);
  const conflictBaseRef = useRef<DraftBase | undefined>(undefined);
  /** The device would not keep this screen's version while it waits: say so, since closing the page would lose it. */
  const [unheld,setUnheld] = useState(false);
  const conflictRef = useRef<Report | null>(null);
  /** A save is on its way to the server; counts every save started, so a check that overlapped one is ignored. */
  const inFlight = useRef(false);
  const saveCount = useRef(0);
  /** Copies set aside on the device while two versions wait for a choice (localDraft.ts setAside). */
  const asides = useRef(new Set<string>());
  const [recovered,setRecovered] = useState(false);
  /** `?add=instruction` from the home tile opens the draft with a new card of that kind. Honoured once. */
  const addedFromLink = useRef(false);
  /** Which step of the draft is showing: building the cards, or checking, signing and sending. */
  const [step,setStep] = useState<'cards' | 'check'>('cards');
  /** Set when this page pushed the #check entry, so the browser's Back returns to the cards. */
  const pushedCheck = useRef(false);
  /** A text field has the keyboard: on the phone the action bar steps aside so it never covers it. A list does not, so it is left out. */
  const [typing,setTyping] = useState(false);
  /** Side-by-side cards and editor from 900px, as in engineer.css; folded cards below that. */
  const wide = useMediaQuery('(min-width: 900px)');

  useEffect(() => {
    const sync = () => {
      const check = window.location.hash === '#check';
      if (!check) pushedCheck.current = false;
      setStep(check ? 'check' : 'cards');
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    const typed = (el: EventTarget | null) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['file', 'checkbox', 'radio', 'button', 'submit'].includes(el.type));
    const onIn = (e: FocusEvent) => setTyping(typed(e.target));
    const onOut = (e: FocusEvent) => { if (!typed(e.relatedTarget)) setTyping(false); };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const principal = d?.principal?.id ?? null;
        setPrincipalId(principal);
        try { if (principal) sessionStorage.setItem('relay-offline-principal',principal); else sessionStorage.removeItem('relay-offline-principal'); } catch {}
      })
      .catch(() => {setPrincipalId(null);setMissing(true);});
  }, []);

  useEffect(() => {
    if (principalId === null) return;
    let cancelled = false;
    (async () => {
      let found;
      try {
        found = await getReport(id);
      } catch {
        const held = await recover(id,principalId,tabId());
        if (held?.key.includes('::aside::')) { asides.current.add(held.key); restoredBase.current = held.base; }
        if (!cancelled && held?.report) {
          seq.current=held.seq;serverVersion.current=held.baseVersion ?? 0;
          adoptSignature(held.report);
          // The server could not be asked, so no card is known to be on it.
          setOnServer({ cards: {} });
          setReport({...held.report,observations:held.observations,version:held.baseVersion ?? 0});
          setSaveState('phone');
        } else if (!cancelled) setMissing(true);
        return;
      }
      if (cancelled) return;
      if (!found) {
        setMissing(true);
        return;
      }
      serverVersion.current = found.version;
      setOnServer(onServerOf(found));
      // Retain the original base version. Local work is not necessarily newer
      // than changes made on another device while this phone was disconnected.
      const held = await recover(id, principalId, tabId());
      if (cancelled) return;
      if (held?.key.includes('::aside::')) { asides.current.add(held.key); restoredBase.current = held.base; }
      if (held && found.state === "draft") {
        seq.current = held.seq;
        serverVersion.current = held.baseVersion ?? 0;
        // The device's copy of the signature is as new as its observations.
        const draftSignature = held.report ? held.report.draftSignature : found.draftSignature;
        const restored: Report = { ...found, version:held.baseVersion ?? 0, observations: held.observations };
        if (draftSignature) restored.draftSignature = draftSignature; else delete restored.draftSignature;
        adoptSignature(restored);
        setReport(restored);
        setSaveState("phone");
        setRecovered(true);
      } else {
        adoptSignature(found);
        setReport(found);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, principalId]);

  /**
   * Autosave after a pause, not on every keystroke: on a poor connection that
   * produces a queue of requests that all land at once and finish out of order.
   */
  const scheduleSave = useCallback(
    (next: Report, retry = false): Promise<boolean> => {
      if (!principalId) return Promise.resolve(false);
      // Two versions are on screen: nothing is sent until one is chosen.
      if (conflictRef.current) return Promise.resolve(false);

      pending.current = next;
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);

      // A retry sends what the device already holds, under the same number, so
      // its copy (and when it was last changed) is left alone.
      const mySeq = retry ? seq.current : (seq.current = clientId());

      // Mirror to the device first, and know whether it worked. Whatever the
      // network then does the work survives a reload, a crash or a flat
      // battery — but only if this actually succeeded, so the result is kept.
      const held = retry ? Promise.resolve(true) : keep({
        reportId: next.id,
        principalId,
        seq: mySeq,
        observations: next.observations,
        baseVersion:serverVersion.current ?? next.version,
        report:next,
        tab:tabId(),
      }).then(
        () => true,
        () => false,
      );

      saveTimer.current = setTimeout(() => {
        // Queued behind whatever is already running, so there is never more
        // than one save in flight for this report.
        chain.current = chain.current.then(async () => {
          const toSave = next;
          if (!toSave || conflictRef.current) return;
          inFlight.current = true; saveCount.current += 1;
          try {
            const saved = await saveReport(toSave, serverVersion.current ?? toSave.version,principalId);
            serverVersion.current = saved.version;
            announce(saved);
            // Release only the edit that was acknowledged. Anything typed
            // since keeps its copy on the device.
            await releaseIfCurrent(toSave.id, principalId, mySeq);
            setReport((current) => (current ? { ...current, version: saved.version } : saved));
            setOnServer(onServerOf(toSave, saved.version));
            if (seq.current === mySeq) {
              pending.current = null;
              setSaveState('saved');
            }
          } catch (error) {
            if (error instanceof SaveConflict) { await showConflict(error.current, latest.current ?? toSave); return; }
            if (!(error instanceof ApiError && error.offline)) setSubmitError(error instanceof Error ? error.message : 'Unable to save.');
            const offline = error instanceof ApiError && error.offline;
            // Not on the server. Whether that is merely inconvenient or
            // actually dangerous depends on whether the device took a copy.
            if (seq.current === mySeq) setSaveState((await held) ? (offline ? "phone" : "error") : "unheld");
          } finally {
            inFlight.current = false;
          }
        });
      }, 700);
      return held;
    },
    [principalId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * The server holds a version this screen did not build on. When the two say
   * the same thing the server's simply replaces this one; otherwise both are
   * shown and saving waits for the engineer. The work on screen stays held on
   * the device throughout, so a reload comes back to the same choice.
   */
  async function showConflict(theirs: Report, mine: Report) {
    if (!principalId) return;
    // The server copy this screen last built on, if it is known: it lets the
    // comparison suggest what each side actually changed.
    const known = onServerRef.current;
    // A second answer during the same conflict keeps the base the first one found.
    const base: DraftBase | undefined = restoredBase.current ?? (conflictRef.current ? conflictBaseRef.current : undefined)
      ?? (!conflictRef.current && known.version !== undefined && known.version === serverVersion.current ? { cards: known.cards, ...(known.signature !== undefined ? { signature: known.signature } : {}) } : undefined);
    setOnServer(onServerOf(theirs));
    setSubmitError(null);
    if (theirs.state !== 'draft') return;
    if (!compareDrafts(mine, theirs).differs) {
      serverVersion.current = theirs.version;
      await releaseIfCurrent(theirs.id, principalId, seq.current);
      await dropAsides();
      conflictRef.current = null; conflictBaseRef.current = undefined; restoredBase.current = undefined;
      setConflict(null);
      pending.current = null;
      setReport(theirs);
      setSaveState('saved');
      return;
    }
    if (!conflictRef.current || conflictRef.current.version < theirs.version) {
      conflictRef.current = theirs;
      conflictBaseRef.current = base;
      setConflictBase(base);
      setConflict(theirs);
      setSaveState('conflict');
    }
    // Another tab's next edit or save would replace or release the shared held
    // copy, so this tab's work is also kept under its own key until the choice.
    try {
      asides.current.add(await setAside({ reportId: mine.id, principalId, tab: tabId(), seq: seq.current, observations: mine.observations, baseVersion: serverVersion.current ?? mine.version, report: mine, ...(base ? { base } : {}) }));
      setUnheld(false);
    } catch { setUnheld(true); }
  }

  /** The engineer chose: save that, on top of the server's version, like any edit. */
  function resolveConflict(merged: Report) {
    conflictRef.current = null;
    restoredBase.current = undefined;
    setConflict(null);
    serverVersion.current = merged.version;
    setSignerName(merged.draftSignature?.name ?? merged.author);
    setSignatureImage(merged.draftSignature?.dataUrl ?? null);
    setReport(merged);
    // The set-aside copies go once the chosen version is held on the device in their place.
    void scheduleSave(merged).then(held => { if (held) void dropAsides(); });
  }

  async function dropAsides() {
    for (const key of [...asides.current]) {
      try { await dropAside(key); asides.current.delete(key); } catch {}
    }
  }

  /** Tell other tabs on this device that the draft moved on. */
  function announce(saved: Report) {
    try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage({ type: 'saved', reportId: saved.id, version: saved.version, tab: tabId() }); channel.close(); } catch {}
  }

  /**
   * Has the draft been saved from somewhere else? Asked when another tab says
   * it saved, and when this tab comes back into view (a phone and a laptop on
   * the same draft). With nothing unsaved here the newer copy is taken
   * quietly; with unsaved work here both are shown.
   */
  const checkServer = useCallback(async () => {
    const current = latest.current;
    if (!current || current.state !== 'draft' || !principalId || sending.current || conflictRef.current || inFlight.current) return;
    const started = saveCount.current, typed = seq.current;
    let found: Report | undefined;
    try { found = await getReport(current.id); } catch { return; }
    // A save from this tab overlapped the check, so its answer may be this tab's own save.
    if (!found || inFlight.current || saveCount.current !== started || found.version <= (serverVersion.current ?? 0)) return;
    if (found.state === 'draft' && pending.current === null && seq.current === typed) {
      serverVersion.current = found.version;
      adoptSignature(found);
      if (!found.draftSignature) { setSignerName(found.author); setSignatureImage(null); }
      setOnServer(onServerOf(found));
      setReport(found);
      return;
    }
    await showConflict(found, latest.current ?? current);
  }, [principalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel(CHANNEL); } catch { return; }
    channel.onmessage = (event: MessageEvent<{ type?: string; reportId?: string; version?: number; tab?: string }>) => {
      const message = event.data ?? {};
      // A duplicated tab copies sessionStorage, and with it this tab's id: tell it to take its own.
      if (message.type === 'hello' && message.tab === tabId()) channel?.postMessage({ type: 'taken', tab: message.tab });
      if (message.type === 'taken' && message.tab === tabId()) renewTabId();
      if (message.type === 'saved' && message.reportId === id && (message.version ?? 0) > (serverVersion.current ?? 0)) void checkServer();
    };
    channel.postMessage({ type: 'hello', tab: tabId() });
    const onVisible = () => { if (document.visibilityState === 'visible') void checkServer(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible); };
  }, [id, checkServer]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  useEffect(() => {
    if (recovered && report && principalId) { setRecovered(false); scheduleSave(report); }
  },[recovered,report,principalId,scheduleSave]);

  // Coming back into signal retries by itself. An engineer walking out of a
  // basement should not have to know to press anything.
  useEffect(() => {
    async function onOnline() {
      const current = pending.current ?? latest.current;
      if (!current || current.state !== "draft" || !principalId || sending.current) return;
      if (await hasUnsent(current.id, principalId)) scheduleSave(current);
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [scheduleSave, principalId]);

  // The phone can have signal while the server is down or restarting, so no
  // "online" event comes. While the work is only on this phone, keep trying.
  useEffect(() => {
    if (saveState !== 'phone' || !principalId) return;
    const timer = setInterval(() => {
      const current = pending.current ?? latest.current;
      if (current?.state === 'draft' && !sending.current && document.visibilityState === 'visible') scheduleSave(current, true);
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [saveState, principalId, scheduleSave]);

  useEffect(() => onPhotoUploads(() => setUploading(uploadingPhotos())), []);

  /** Show the name and drawing saved with the draft, before the pad first appears. */
  function adoptSignature(from: Report) {
    if (from.state !== 'draft' || !from.draftSignature) return;
    setSignerName(from.draftSignature.name);
    setSignatureImage(from.draftSignature.dataUrl ?? null);
  }

  /** The signature is part of the draft, so it saves and survives a reload like any edit. */
  function updateSignature(name: string, image: string | null) {
    setSignerName(name);
    setSignatureImage(image);
    const current = latest.current;
    if (!current || current.state !== 'draft') return;
    const { draftSignature: _old, ...rest } = current;
    update({ ...rest, draftSignature: { name, ...(image ? { dataUrl: image } : {}) } });
  }

  useEffect(() => {
    latest.current = report;
    if (report && signerName === "") setSignerName(report.author);
  }, [report]);

  // Context from previous visits. Fetched once the report is known so the
  // engineer can attach a repeat sighting instead of raising a duplicate, and
  // pick a place already used here rather than typing it again.
  useEffect(() => {
    if (!report) return;
    fetchOpenIssues(report.projectId)
      .then(setProjectIssues)
      .catch(() => setProjectIssues([]));
    projectLocations(report.projectId).then(setLocations).catch(() => setLocations([]));
  }, [report?.projectId]);

  function update(next: Report) {
    if (sending.current) return;
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

  const addCard = useCallback((kind?: ObservationType) => {
    const current = latest.current;
    if (!current || current.state !== 'draft' || sending.current) return;
    const o = newObservation();
    if (kind) {
      o.type = kind;
      if (kind === 'defect' && principal?.trade) o.affectedTrade = principal.trade;
    } else {
      setPicking(p => [...p, o.id]);
    }
    update({ ...current, observations: [...current.observations, o] });
    setSelectedSection(o.id);
  }, [principal?.trade]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * A new card at the same place as `sourceId`, placed next to it. Only the
   * location is filled in; the engineer still picks the kind, and nothing they
   * found or photographed on the earlier card comes with it.
   */
  function addAtSameLocation(sourceId: string) {
    const current = latest.current;
    if (!current || current.state !== 'draft' || sending.current) return;
    const source = current.observations.find(o => o.id === sourceId);
    if (!source?.location.trim()) return;
    const o = cardAtSameLocation(source, newObservation());
    setPicking(p => [...p, o.id]);
    update({ ...current, observations: insertAfterSameLocation(current.observations, sourceId, o) });
    openCard(o.id);
  }

  // The home screen's "Request a variation" lands here with the card already started.
  useEffect(() => {
    if (!report || report.state !== 'draft' || addedFromLink.current) return;
    let add = '';
    try { add = new URLSearchParams(window.location.search).get('add') ?? ''; } catch {}
    if (!KINDS.includes(add as ObservationType)) return;
    addedFromLink.current = true;
    addCard(add as ObservationType);
    try { const url = new URL(window.location.href); url.searchParams.delete('add'); window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`); } catch {}
  }, [report?.id, report?.state, addCard]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!report || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Wait for any save already running, so what is submitted is the version
      // the engineer just reviewed rather than whatever lands last.
      await chain.current;
      const saved = await saveReport(report, serverVersion.current ?? report.version,principalId ?? undefined);
      serverVersion.current = saved.version;
      announce(saved);
      setReport(saved);
      setOnServer(onServerOf(report, saved.version));
      const sent = await submitReport(saved, {
        ...(signatureImage ? { dataUrl: signatureImage } : {}),
        name: signerName.trim() || report.author,
      });
      if (principalId) await releaseIfCurrent(report.id, principalId, seq.current);
      setReport(sent);
      pending.current = null;
      setSaveState("clean");
    } catch (error) {
      if (error instanceof SaveConflict) {
        // Saved elsewhere since this screen last saved: nothing is sent until the engineer chooses.
        await showConflict(error.current, report);
      } else if (error instanceof ApiError && error.offline) {
        // Sending failed, so make certain the device is holding the work before
        // telling anyone it is safe.
        const held = principalId
          ? await keep({
              reportId: report.id,
              principalId,
              seq: seq.current,
              observations: report.observations,
              baseVersion:serverVersion.current ?? report.version,
              report,
              tab:tabId(),
            }).then(
              () => true,
              () => false,
            )
          : false;
        setSaveState(held ? "phone" : "unheld");
        setSubmitError(
          held
            ? "No connection, so this has not reached the office yet. Your work is held on this phone — try again when you have signal."
            : "No connection, and this device would not store a copy. Do not close this page: your work only exists on this screen. Move somewhere with signal and send again.",
        );
      } else {
        setSubmitError(error instanceof Error ? error.message : "That could not be sent.");
      }
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <main className="wrap">
        <Link href="/projects" className="back">&larr; Projects</Link>
        <div className="empty">This report could not be loaded. Check your connection or sign in again.</div>
        <a href="/offline.html">Recover drafts retained on this phone</a>
      </main>
    );
  }
  if (!report) {
    return (
      <main className="wrap">
        <div className="empty" style={{ marginTop: 32 }}>Loading</div>
      </main>
    );
  }

  const project = report.projectSnapshot ?? getProject(report.projectId);
  const findings = reviewReport(report);
  const stop = findings.filter((f) => f.blocking);
  const note = findings.filter((f) => !f.blocking);
  const sent = report.state === "submitted";
  const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);
  const mine = principal ? ownsReport(principal, report) : false;
  const counts = Object.fromEntries(KINDS.map(k => [k, report.observations.filter(o => o.type === k).length])) as Record<ObservationType, number>;
  // The open card. Side by side there is always one in the editor column; on
  // the phone every card starts folded, so the report reads as a short list.
  const open = report.observations.some(o => o.id === selectedSection) ? selectedSection : wide ? report.observations.at(-1)?.id ?? null : null;
  const shortRef = report.reference.split('-').slice(1).join('-');
  // Where each card and photograph is. Offline means the server could not be
  // reached, so anything not yet on it is only on this phone.
  const offline = saveState === 'phone';
  const whereOf = new Map(report.observations.map(o => [o.id, cardWhere(o, onServer.cards[o.id], uploading, offline)]));
  // Removing a card or changing the signature also waits for a save, so the summary never goes green before it lands.
  const whereAll = reportWhere([...whereOf.values()], offline, {
    removed: Object.keys(onServer.cards).filter(cardId => !whereOf.has(cardId)).length,
    signature: report.state === 'draft' && signatureCopy(report) !== onServer.signature && !(onServer.signature === undefined && !report.draftSignature),
  });
  const kindOf = (o: Observation) => OBSERVATION_TYPES.find(t => t.value === o.type);
  const extras = (o: Observation) => [o.affectedTrade && `Trade: ${o.affectedTrade}`, o.variationReason, o.workDone && 'already carried out', o.askedBy && `asked for by ${o.askedBy}`, o.roughSize && ({ 'half-day': 'about half a day', day: 'about a day', 'two-days': 'about two days', more: 'more than two days' })[o.roughSize], o.partsEstimate !== undefined && `parts about £${o.partsEstimate}`].filter(Boolean).join(' · ');

  /** Open a card on the cards step and bring it into view. */
  function openCard(cardId: string) {
    setSelectedSection(cardId);
    showCards();
    requestAnimationFrame(() => document.getElementById(wide ? 'card-editor' : `slot-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function showCheck() {
    if (step === 'check') return;
    try { window.history.pushState(window.history.state, '', '#check'); pushedCheck.current = true; } catch {}
    setStep('check');
    window.scrollTo({ top: 0 });
  }

  function showCards() {
    if (step === 'cards') return;
    if (pushedCheck.current) { window.history.back(); return; }
    try { window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`); } catch {}
    setStep('cards');
  }

  /**
   * A card folded to one line: where, what kind, what was written and how many
   * photographs, with a warning when sending would be stopped by it. Tapping
   * it opens the card; on the phone tapping the open card folds it again.
   */
  const cardRow = (o: Observation, i: number) => {
    const k = kindOf(o);
    const stopped = stop.find(f => f.observationId === o.id);
    const choosing = picking.includes(o.id);
    const text = o.whatHappened.trim();
    const isOpen = open === o.id;
    return <button type="button" key={`row-${o.id}`} className={`eng-row eng-cardrow ${isOpen ? 'on' : ''} ${stopped ? 'late' : ''}`} aria-expanded={wide ? undefined : isOpen} aria-current={wide && isOpen ? 'true' : undefined} onClick={() => { if (!wide && isOpen) setSelectedSection(''); else openCard(o.id); }}>
      <span className="no">{String(i + 1).padStart(2, '0')}</span>
      <div className="main">
        <span className="top"><span className={`kind tone-${k?.tone ?? 'neutral'}`}>{choosing ? 'New' : k?.short ?? o.type}</span><b>{o.location.trim() || (choosing ? 'Choose a kind' : 'No location yet')}</b></span>
        <span className="desc">{choosing ? 'What kind of update is this?' : text || 'Nothing written yet'}</span>
        {!choosing && <span className="meta">{o.photos.length} photo{o.photos.length === 1 ? '' : 's'}{stopped ? <em> · {unlabelled(stopped.message, o)}</em> : null}</span>}
        {!choosing && <CardWhereLine where={whereOf.get(o.id)} />}
      </div>
      {!wide && <span className="chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>}
    </button>;
  };

  /** The open card's questions, or the kind picker for a card that has none yet. */
  const cardBody = (observation: Observation, index: number) => picking.includes(observation.id)
    ? <KindPicker onPick={k => { setPicking(p => p.filter(x => x !== observation.id)); const copy: Observation = { ...observation, type: k }; if (k === 'defect' && principal?.trade) copy.affectedTrade = principal.trade; update({ ...report, observations: report.observations.map(o => o.id === observation.id ? copy : o) }); }} />
    : <>
        <ObservationEditor
          observation={observation}
          index={index}
          openIssues={projectIssues}
          locations={locations}
          photoWhere={(photoId) => { const w = whereOf.get(observation.id); const at = observation.photos.findIndex(p => p.id === photoId); return w && at >= 0 ? w.each[at] : undefined; }}
          onChange={(next) => update({ ...report, observations: report.observations.map((o) => (o.id === next.id ? next : o)) })}
          onRemove={() => { setPicking(p => p.filter(x => x !== observation.id)); update({ ...report, observations: report.observations.filter((o) => o.id !== observation.id) }); }}
        />
        <div className="eng-card-actions">
          {observation.location.trim() && <button type="button" className="eng-same-place" onClick={() => addAtSameLocation(observation.id)} disabled={submitting}>
            <span>+ Another card here</span><small>{observation.location.trim()}</small>
          </button>}
          {wide
            ? <button type="button" onClick={() => addCard()} disabled={submitting}>+ Add another card</button>
            : <button type="button" className="eng-done" onClick={() => { setSelectedSection(''); requestAnimationFrame(() => document.getElementById(`slot-${observation.id}`)?.scrollIntoView({ block: 'nearest' })); }}>Done with this card</button>}
          <button type="button" className="eng-review-link" onClick={() => showCheck()}>Check &amp; send &rarr;</button>
        </div>
      </>;

  async function startCorrection() {
    if (!correctionReason.trim()) { setCorrectionError('Say why this correction is needed.'); return; }
    if (!report) return;
    setCorrectionError('');
    try {
      const projectId = report.projectId;
      const draft = await requestCorrection(report.id, correctionReason.trim());
      router.push(withViewReturn(`/reports/${draft.id}`, safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(projectId)}`)));
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : 'The correction could not be started.');
    }
  }

  const findingRows = (items: typeof findings, kind: 'stop' | 'note') => items.map((f, i) => <button key={`${kind}${i}`} type="button" className={`find ${kind === 'stop' ? 'find-stop' : 'find-note'}`} style={{ width: '100%', textAlign: 'left', minHeight: 0, background: 'none', font: 'inherit', cursor: f.observationId ? 'pointer' : 'default' }} onClick={() => { if (f.observationId) openCard(f.observationId); }}>
    <span className="find-kind">{kind === 'stop' ? 'Stop' : 'Check'}</span>
    <span>{f.message}</span>
  </button>);

  return (
    <main className={sent ? "wrap eng-page" : "wrap wrap-pad eng-report-editor"}>
      <Link href={safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(report.projectId)}`)} className="back">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1>{sent ? report.reference : 'Site update'}</h1>
          <p className="sub">{project?.projectName} · <span className="ref">{report.reference}</span>{sent ? '' : ' · draft'}{report.corrects && !sent ? ` · correction, rev ${report.revision}` : ''}</p>
        </div>
        <span className={sent ? "tag tag-sent" : "tag tag-draft"}>{sent ? "Sent" : "Draft"}</span>
      </div>

      {/* A correction draft says what it corrects and why, so the sent report is
          never mistaken for something that can be edited. */}
      {!sent && report.corrects && (
        <div className="note" style={{ marginTop: 16, borderLeftColor: "var(--brass)" }}>
          <strong>Correction · rev {report.revision}.</strong> {report.correctionReason}
          <br />
          Sending issues rev {report.revision} and supersedes rev {report.revision - 1}, which stays on file.
        </div>
      )}

      {sent && (
        <div className={`note ${report.review === "returned" ? "note-bad" : "note-ok"}`} style={{ marginTop: 16 }}>
          {report.review === "returned" && (
            <p style={{ margin: "0 0 8px" }}>
              <strong>Sent back by {report.reviewedBy ?? "the office"}.</strong> {report.reviewNote}
            </p>
          )}
          <p style={{ margin: 0 }}>
            Received by Relay {fmtWhen(report.serverAcknowledgedAt)}. It can no longer be edited — a correction is issued as a new revision.{" "}
            <Link href={withViewReturn(`/reports/${report.id}/preview`, safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(report.projectId)}`))} style={{ color: "var(--brass)" }}>
              View the document &rarr;
            </Link>
          </p>
          {/* Each step after sending, the same steps the office sees. */}
          <SubmissionStages report={report} tagClass={toneClass} when={fmtWhen} />
          {mine && !correcting && (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn-sm" onClick={() => setCorrecting(true)}>
                {report.review === "returned" ? "Make the correction" : "Make a correction"}
              </button>
            </div>
          )}
          {mine && correcting && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="correction-reason">Why is a correction needed?</label>
              <textarea
                id="correction-reason"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Printed on the corrected revision"
              />
              {correctionError && <p className="hint" style={{ color: "var(--alert)" }}>{correctionError}</p>}
              <div className="btn-row">
                <button className="btn-primary btn-sm" onClick={startCorrection}>Start correction</button>
                <button className="btn-sm" onClick={() => setCorrecting(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {sent ? <>
        <div className="sec"><span className="lbl">{report.observations.length} card{report.observations.length === 1 ? '' : 's'} · {photos} photograph{photos === 1 ? '' : 's'}</span></div>
        {report.observations.length === 0 ? <div className="empty">No updates were recorded on this visit.</div> : report.observations.map((o, i) => { const k = kindOf(o); return <section key={o.id} className={`eng-sent-card tone-${k?.tone ?? 'neutral'}`}>
          <div className="head"><span className="lbl">Card {String(i + 1).padStart(2, '0')} · {o.location || 'No location'}</span><span className={`kind tone-${k?.tone ?? 'neutral'}`}>{k?.short ?? o.type}</span></div>
          <p>{o.whatHappened}</p>
          {(o.actionNeeded.trim() || o.owner.trim()) && <small>{o.actionNeeded.trim() && `Action: ${o.actionNeeded}`}{o.actionNeeded.trim() && o.owner.trim() && ' · '}{o.owner.trim() && `For: ${o.owner}`}</small>}
          {extras(o) && <small>{extras(o)}</small>}
          {o.photos.length > 0 && <small>{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}</small>}
        </section>; })}
      </> : conflict ? <DraftConflict key={conflict.version} here={report} there={conflict} base={conflictBase} unheld={unheld} saving={submitting} onSave={resolveConflict} /> : <>
        {/* Two steps, so the cards and the final check never compete for the
            same scroll: build the report, then check, sign and send it. */}
        <nav className="eng-steps" aria-label="Report steps">
          <button type="button" aria-current={step === 'cards' ? 'step' : undefined} onClick={() => showCards()}><span className="n">1</span>Cards<small>{report.observations.length}</small></button>
          <button type="button" aria-current={step === 'check' ? 'step' : undefined} onClick={() => showCheck()}><span className="n">2</span>Check &amp; send{stop.length > 0 && <small className="late">{stop.length}</small>}</button>
        </nav>

        {step === 'cards' && (wide ? <div className="eng-editor-grid">
          <aside className="eng-rail" aria-label="Cards in this update">
            <div className="eng-section-title" style={{ margin: 0 }}><h2>Cards</h2><span className="r">{report.observations.length}</span></div>
            <div className="eng-list">
              {report.observations.length === 0 && <div className="eng-empty">No cards yet. Add one for each thing you did, found or need.</div>}
              {report.observations.map((o, i) => cardRow(o, i))}
            </div>
            <button type="button" className="eng-add" disabled={submitting} onClick={() => addCard()}>+ Add a card</button>
            {findings.length > 0 && <div className="eng-finds"><span className="lbl">Before you send</span>{findingRows(stop, 'stop')}{findingRows(note.slice(0, 3), 'note')}</div>}
          </aside>
          <div id="card-editor" style={{ scrollMarginTop: 24 }}>
            {report.observations.length === 0 ? <KindPicker onPick={k => addCard(k)} /> : report.observations.map((o, i) => <div key={o.id} hidden={open !== o.id}>{cardBody(o, i)}</div>)}
          </div>
        </div> : <div className="eng-acc" id="card-editor">
          {/* On the phone each card folds to one summary row, and the open
              card unfolds under its own row rather than somewhere below. */}
          {report.observations.length === 0 ? <KindPicker onPick={k => addCard(k)} /> : <div className="eng-list">
            {report.observations.map((o, i) => <div key={o.id} id={`slot-${o.id}`} className={`eng-slot ${open === o.id ? 'open' : ''}`}>
              {cardRow(o, i)}
              <div hidden={open !== o.id}>{cardBody(o, i)}</div>
            </div>)}
          </div>}
          {report.observations.length > 0 && <button type="button" className="eng-add" disabled={submitting} onClick={() => addCard()}>+ Add a card</button>}
        </div>)}

        {step === 'check' && <div id="report-check" className="eng-check">
          {findings.length === 0 ? (
            <div className="note note-ok">Everything needed is here.</div>
          ) : (
            <div className="eng-finds">
              {/* Blocking omissions and things worth a look are separated: an
                  engineer should be stopped by a defect with no photograph, and
                  not stopped by a missing caption. */}
              {findingRows(stop, 'stop')}
              {findingRows(note, 'note')}
            </div>
          )}

          {whereAll.text && <p className={`eng-where eng-where-${whereAll.where}`} aria-live="polite"><span className={WHERE_DOT[whereAll.where]} />{whereAll.text}</p>}

          <div className="sec"><span className="lbl">In this report</span></div>
          <dl className="eng-sum">
            <div><dt>Progress</dt><dd>{counts.update}</dd></div>
            <div><dt>Defects</dt><dd className={counts.defect ? 'late' : ''}>{counts.defect}<small>{counts.defect ? 'raise issues' : ''}</small></dd></div>
            <div><dt>Variations</dt><dd className={counts.instruction ? 'soon' : ''}>{counts.instruction}<small>{counts.instruction ? 'raise VOs' : ''}</small></dd></div>
            <div><dt>Access</dt><dd>{counts.access}<small>{counts.access ? 'raise issues' : ''}</small></dd></div>
          </dl>

          {report.observations.length > 0 && <div className="eng-does">
            <span className="lbl">What sending does</span>
            <div className="eng-list" style={{ marginTop: 8 }}>
              {counts.defect + counts.access > 0 && <div className="eng-row"><div className="main"><b>{counts.defect + counts.access} issue{counts.defect + counts.access === 1 ? '' : 's'} raised · not yet reviewed</b><span>{report.observations.filter(o => (o.type === 'defect' || o.type === 'access') && o.linkedIssueId).length ? 'Linked ones add a sighting to the existing issue. ' : ''}The office assigns them; you’ll see who and when on your home screen.</span></div></div>}
              {counts.instruction > 0 && <div className="eng-row"><div className="main"><b>{counts.instruction} variation{counts.instruction === 1 ? '' : 's'} raised · need a quote</b><span>{report.observations.some(o => o.type === 'instruction' && o.workDone) ? 'Marked as already done: the office gets the client’s sign-off before it is invoiced. ' : ''}The office prices it and puts it to the client.</span></div></div>}
              <div className="eng-row"><div className="main"><b>Received the moment it lands</b><span>{project?.projectManager ?? 'The project manager'} is emailed when the mailbox is live; the office can read it straight away.</span></div></div>
            </div>
          </div>}

          <div className="sec"><span className="lbl">Sign</span></div>

          <section className="panel">
            <div className="panel-body">
              <SignaturePad
                name={signerName}
                initialImage={signatureImage}
                onNameChange={(next) => updateSignature(next, signatureImage)}
                onChange={(image) => updateSignature(signerName, image)}
              />
            </div>
          </section>
        </div>}

        {submitError && (
          <div className="note note-bad" style={{ marginTop: 16 }}>{submitError}</div>
        )}

        {/* One primary action, always reachable, with the save state beside
            it so the two are never read separately. On the phone it steps
            aside while a field has the keyboard, so it never covers the
            field being typed in. */}
        <div className={`actionbar ${typing ? 'is-typing' : ''}`}>
          <div className="actionbar-inner">
            <span className="savestate" aria-live="polite">
              <span className={SAVE[saveState].dot} />
              {step === 'check' && stop.length > 0
                ? <span className="actionbar-warning"><b>{stop.length} {stop.length === 1 ? 'item needs' : 'items need'} attention</b><span>Tap one above to fix it</span></span>
                : <b>{SAVE[saveState].text || (step === 'check' ? 'Ready to send' : `${report.observations.length} card${report.observations.length === 1 ? '' : 's'}`)}</b>}
            </span>
            {step === 'cards'
              ? <button className="btn-primary" onClick={() => showCheck()} disabled={submitting}>Check &amp; send &rarr;</button>
              : <button className="btn-primary" onClick={send} disabled={submitting || stop.length > 0}>
                  {submitting ? "Sending…" : "Send to office"}
                </button>}
          </div>
        </div>
      </>}
    </main>
  );
}

/** The draft as the server holds it: each card (savedCopy) and the signature. Unknown when the server could not be asked. */
interface OnServer { cards: Record<string, string>; signature?: string; version?: number }
const signatureCopy = (r: Report) => JSON.stringify(r.draftSignature ?? null);
function onServerOf(r: Report, version = r.version): OnServer {
  return { cards: Object.fromEntries(r.observations.map(o => [o.id, savedCopy(o)])), signature: signatureCopy(r), version };
}

/** One line under a folded card: on the server, or what is still to go up. */
function CardWhereLine({ where }: { where: ReturnType<typeof cardWhere> | undefined }) {
  if (!where) return null;
  const left = where.photos - where.photosOnServer;
  const detail = where.where === 'server' || where.where === 'uploading' ? ''
    : !where.text ? (left ? ` · changes and ${left} photo${left === 1 ? '' : 's'}` : ' · changes')
    : left ? ` · ${left} photo${left === 1 ? '' : 's'}` : '';
  return <span className={`eng-where eng-where-${where.where}`}><span className={WHERE_DOT[where.where]} />{WHERE[where.where]}{detail}</span>;
}

/** A finding without its "Location: " prefix, for the row that already names the location. */
function unlabelled(message: string, o: Observation): string {
  const prefix = `${o.location || 'Unspecified location'}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
