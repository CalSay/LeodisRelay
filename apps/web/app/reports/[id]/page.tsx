"use client";
import { useProjectLookup } from "@/components/ProjectContext";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { PageTitle } from '@/components/PageTitle';
import Link from "next/link";
import {
  getReport,
  newObservation,
  openIssues as fetchOpenIssues,
  projectSuggestions,
  reviewReport,
  saveReport,
  submitReport,
  type Observation,
  type Report,
} from "@/lib/api";
import { ApiError, SaveConflict } from "@/lib/api";
import type { ProjectSuggestions } from "@/lib/suggestions";
import { clientId } from '@/lib/clientId';
import { dropAside, hasUnsent, keep, recover, releaseIfCurrent, setAside } from "@/lib/localDraft";
import { KindPicker, ObservationEditor } from "@/components/ObservationEditor";
import { CheckEditor } from "@/components/CheckEditor";
import { CHECK_ANSWERS, checkCounts, checkHint, reportTypeOf } from "@/lib/reportTypes";
import { SignaturePad } from "@/components/SignaturePad";
import type { Issue as IssueSummary } from "@/lib/types";
import { heldSendBusy, heldSendSettled } from '@/lib/heldSend';
import { usePrincipal } from '@/components/PrincipalContext';
import { useRouter } from 'next/navigation';
import { correctReport as requestCorrection } from '@/lib/api';
import { ownsReport } from '@/lib/auth/access';
import { toneClass } from '@/lib/status';
import { SubmissionStages } from '@/components/SubmissionStages';
import { OBSERVATION_TYPES, type ObservationType } from '@/lib/fixtures';
import { backLabel, safeViewReturn, viewName, withViewReturn } from '@/lib/viewNavigation';
import { cardAtSameLocation, insertAfterSameLocation } from '@/lib/sameLocation';
import { canUndo, removeCard, removedLabel, removePhoto, restoreRemoved, type Removed } from '@/lib/undoRemove';
import { onPhotoUploads, uploadingPhotos } from '@/lib/localMedia';
import { cardWhere, reportWhere, savedCopy, WHERE, type Where } from '@/lib/uploadStatus';
import { compareDrafts, type DraftBase } from '@/lib/draftConflict';
import { DraftConflict } from '@/components/DraftConflict';
import { renewTabId, tabId } from '@/lib/tabId';
import { carryIntoCorrection, SENT_ELSEWHERE_REASON, unsentWork, type UnsentWork } from '@/lib/sentElsewhere';
import { SentElsewhere } from '@/components/SentElsewhere';

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
  phone: { dot: "dot dot-busy", text: "On this phone only · goes up with signal" },
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
/** How long Undo stays offered after removing a card or photograph, unless the bar has focus or a pointer over it. */
const UNDO_MS = 12_000;

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
  const [suggestions,setSuggestions] = useState<ProjectSuggestions>({ locations: [], companies: [] });

  const [report, setReport] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);
  const [waitingForHeld, setWaitingForHeld] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [projectIssues, setProjectIssues] = useState<IssueSummary[]>([]);
  const [signerName, setSignerName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  /** Signed by typing the name and ticking the statement, in place of a drawing (lib/signature.ts). */
  const [signatureTyped, setSignatureTyped] = useState(false);
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
  /** The card or photograph just removed, offered back with Undo. One at a time: a second removal replaces it. */
  const [removed,setRemoved] = useState<{ item: Removed; title: string; detail: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  /**
   * What a screen reader hears. Cleared and set again on each removal, so a
   * second removal worded the same ("Photo 01 removed") is still announced.
   */
  const [undoSaid,setUndoSaid] = useState('');
  /**
   * Sent from another tab or device while this screen held changes the server
   * never had. The sent report is shown, with those changes offered as a correction.
   */
  const [sentAway,setSentAway] = useState<{ work: UnsentWork; mine: Report; base?: DraftBase } | null>(null);
  const sentAwayRef = useRef(false);
  const [handoffReason,setHandoffReason] = useState(SENT_ELSEWHERE_REASON);
  const [handoffError,setHandoffError] = useState('');
  /** Where to go when the correction cannot take the changes yet. */
  const [handoffLink,setHandoffLink] = useState<{ href: string; label: string } | null>(null);
  const [handingOff,setHandingOff] = useState(false);

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

  /**
   * Where focus goes once a card or the check step has rendered, so a keyboard
   * or screen reader is not left on "Next check" or a Stop that has just gone.
   */
  const focusNext = useRef<string | null>(null);
  const focusTarget = useCallback((target: string) => {
    const el = target === 'check' ? document.getElementById('report-check-title')
      : wide ? document.querySelector<HTMLElement>(`[data-card-body="${CSS.escape(target)}"]`)
      : document.querySelector<HTMLElement>(`#slot-${CSS.escape(target)} > button`);
    el?.focus({ preventScroll: true });
  }, [wide]);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    // Wait for the step to change (it can follow Back, on popstate) and for that card to be the open one.
    if (target === 'check' ? step !== 'check' : step !== 'cards' || selectedSection !== target) return;
    focusNext.current = null;
    focusTarget(target);
  }, [step, selectedSection, focusTarget]);

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
    sentAwayRef.current = false;
    setSentAway(null);
    (async () => {
      // This report's work from the offline page may be going up as it opens
      // (HeldWork.tsx): wait for a save in flight, or take over one only queued.
      setWaitingForHeld(heldSendBusy(id));
      await heldSendSettled(id);
      if (cancelled) return;
      setWaitingForHeld(false);
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
      if (held && found.state === 'submitted') {
        // Work held for a draft that has since been sent. When the sent version
        // is the one it was built on, that is its base: sending changes no version.
        seq.current = held.seq;
        const base = held.base ?? (held.baseVersion === found.version ? { cards: onServerOf(found).cards } : undefined);
        await showSent(found, { ...(held.report ?? found), state: 'draft', observations: held.observations }, base, held.baseVersion);
      } else if (held && found.state === "draft") {
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
      if (conflictRef.current || sentAwayRef.current) return Promise.resolve(false);

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
          if (!toSave || conflictRef.current || sentAwayRef.current) return;
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
    if (theirs.state !== 'draft') { await showSent(theirs, mine, base); return; }
    setOnServer(onServerOf(theirs));
    setSubmitError(null);
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
      // Undo would act on a draft that is about to be chosen between, so it is withdrawn.
      dismissUndo();
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
    setSignatureTyped(Boolean(merged.draftSignature?.typed));
    setReport(merged);
    // The set-aside copies go once the chosen version is held on the device in their place.
    void scheduleSave(merged).then(held => { if (held) void dropAsides(); });
  }

  async function dropAsides() {
    for (const key of [...asides.current]) {
      try { await dropAside(key); asides.current.delete(key); } catch {}
    }
  }

  /**
   * The draft was sent from somewhere else. Whatever this screen holds that the
   * sent report does not is kept on the device and offered as a correction; the
   * sent revision itself is never changed. With nothing missing, the sent report
   * simply replaces the draft.
   */
  async function showSent(sent: Report, mine: Report, base?: DraftBase, builtOn = serverVersion.current) {
    // Already shown: a save or check that overlapped the first answer brings nothing new,
    // and handling it again would judge the sent report against itself and let the work go.
    if (!principalId || sentAwayRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    sentAwayRef.current = true;
    conflictRef.current = null; conflictBaseRef.current = undefined; restoredBase.current = undefined;
    setConflict(null);
    pending.current = null;
    dismissUndo();
    serverVersion.current = sent.version;
    setOnServer(onServerOf(sent));
    setSubmitError(null);
    setSaveState('clean');
    setReport(sent);
    const work = mine.state === 'draft' ? unsentWork(mine, sent, base) : { changes: [], observations: [] };
    if (!work.changes.length) {
      await releaseIfCurrent(sent.id, principalId, seq.current);
      await dropAsides();
      setSentAway(null);
      return;
    }
    setSentAway({ work, mine, ...(base ? { base } : {}) });
    // The editor has gone from under the engineer: bring the offer into view.
    window.scrollTo({ top: 0 });
    // Kept under this tab's own key, so a reload comes back to the same offer.
    try {
      asides.current.add(await setAside({ reportId: mine.id, principalId, tab: tabId(), seq: seq.current, observations: mine.observations, baseVersion: builtOn ?? mine.version, report: mine, ...(base ? { base } : {}) }));
      setUnheld(false);
    } catch { setUnheld(true); }
  }

  /** Let this screen's changes go: the sent report is all there is. */
  async function discardSentAway() {
    if (!principalId || !report) return;
    setHandingOff(true);
    await releaseIfCurrent(report.id, principalId, seq.current);
    await dropAsides();
    setSentAway(null);
    setHandingOff(false);
  }

  /**
   * Start a correction to the sent report and put this screen's changes into
   * it. A new correction is saved with them straight away. Where a correction
   * was already started, or the save is refused, the changes are held on the
   * device against it instead, so its editor compares the two before anything
   * is saved. Offline, they wait on the device and save when it opens.
   */
  async function correctWithChanges() {
    if (!principalId || !report || !sentAway) return;
    const reason = handoffReason.trim();
    if (!reason) { setHandoffError('Say why this correction is needed.'); return; }
    setHandingOff(true);
    setHandoffError('');
    setHandoffLink(null);
    const back = safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(report.projectId)}`);
    try {
      let work = sentAway.work, target: Report = report;
      let draft = await requestCorrection(report.id, reason);
      // A correction was already sent: carry the changes onto that revision
      // instead, judged against the same base, so nothing it changed is undone.
      for (let n = 0; draft.state !== 'draft'; n++) {
        if (n === 5) throw new Error('Too many corrections were sent at once.');
        // A correction links its defect cards to the issues already raised; those links are not this screen's changes.
        const links = new Set(sentAway.mine.observations.filter(o => !o.linkedIssueId).map(o => o.id));
        const asSent: Report = { ...draft, observations: draft.observations.map(o => { if (!links.has(o.id) || !o.linkedIssueId) return o; const { linkedIssueId: _link, ...rest } = o; return rest; }) };
        work = unsentWork(sentAway.mine, asSent, sentAway.base);
        if (!work.changes.length) break;
        target = draft;
        draft = await requestCorrection(draft.id, reason);
      }
      if (draft.state === 'draft') {
        // Unsaved work on this device for that correction comes first: overwriting it here would lose it.
        if (await recover(draft.id, principalId)) {
          setHandoffError(`This device holds unsaved changes to rev ${draft.revision}. Open it so they are saved, then come back here to add yours. Your changes are still kept on this device.`);
          setHandoffLink({ href: withViewReturn(`/reports/${draft.id}`, back), label: `Open rev ${draft.revision}` });
          return;
        }
        const observations = carryIntoCorrection(work.observations, draft);
        const carried: Report = { ...draft, observations };
        let done = false, compare = draft.version !== 1;
        if (!compare) {
          try { await saveReport(carried, draft.version, principalId); done = true; }
          catch (error) { compare = error instanceof SaveConflict; }
        }
        if (!done) {
          const held = { reportId: draft.id, principalId, seq: clientId(), observations, report: carried, tab: tabId() };
          // Version 0 is never current, so the correction's editor shows both before saving.
          // Its base is the cards a correction starts with, so edits already made to it are suggested, not undone.
          const base: DraftBase = { cards: Object.fromEntries(carryIntoCorrection(target.observations, draft).map(o => [o.id, savedCopy(o)])) };
          if (compare) await setAside({ ...held, baseVersion: 0, base });
          else await keep({ ...held, baseVersion: draft.version });
        }
      }
      await releaseIfCurrent(report.id, principalId, seq.current);
      await dropAsides();
      setSentAway(null);
      router.push(withViewReturn(`/reports/${draft.id}`, back));
    } catch (error) {
      setHandoffError(error instanceof ApiError && error.offline
        ? 'No connection, so the correction could not be started. Your changes are still kept on this device: try again when you have signal.'
        : `${error instanceof Error ? error.message : 'The correction could not be started.'} Your changes are still kept on this device.`);
    } finally {
      setHandingOff(false);
    }
  }

  /** Tell other tabs on this device that the draft moved on, or was sent. */
  function announce(saved: Report, type: 'saved' | 'sent' = 'saved') {
    try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage({ type, reportId: saved.id, version: saved.version, tab: tabId() }); channel.close(); } catch {}
  }

  /**
   * Has the draft been saved from somewhere else? Asked when another tab says
   * it saved, and when this tab comes back into view (a phone and a laptop on
   * the same draft). With nothing unsaved here the newer copy is taken
   * quietly; with unsaved work here both are shown.
   */
  const checkServer = useCallback(async () => {
    const current = latest.current;
    if (!current || current.state !== 'draft' || !principalId || sending.current || inFlight.current) return;
    const started = saveCount.current, typed = seq.current;
    let found: Report | undefined;
    try { found = await getReport(current.id); } catch { return; }
    // Sent from elsewhere: sending changes no version, so this is checked first, even mid-choice.
    if (found && found.state !== 'draft' && !sending.current && latest.current?.state === 'draft') { await showConflict(found, latest.current); return; }
    if (conflictRef.current) return;
    // A save from this tab overlapped the check, so its answer may be this tab's own save.
    if (!found || inFlight.current || saveCount.current !== started || found.version <= (serverVersion.current ?? 0)) return;
    if (found.state === 'draft' && pending.current === null && seq.current === typed) {
      serverVersion.current = found.version;
      adoptSignature(found);
      if (!found.draftSignature) { setSignerName(found.author); setSignatureImage(null); setSignatureTyped(false); }
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
      if (message.type === 'sent' && message.reportId === id) void checkServer();
    };
    channel.postMessage({ type: 'hello', tab: tabId() });
    const onVisible = () => { if (document.visibilityState === 'visible') void checkServer(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible); };
  }, [id, checkServer]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
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
    setSignatureTyped(Boolean(from.draftSignature.typed));
  }

  /** The signature is part of the draft, so it saves and survives a reload like any edit. */
  function updateSignature(name: string, image: string | null, typed = false) {
    // One way at a time: a typed signature has no drawing, and a drawing is not typed.
    if (image) typed = false;
    setSignerName(name);
    setSignatureImage(image);
    setSignatureTyped(typed);
    const current = latest.current;
    if (!current || current.state !== 'draft') return;
    const { draftSignature: _old, ...rest } = current;
    update({ ...rest, draftSignature: { name, ...(image ? { dataUrl: image } : typed ? { typed: true as const } : {}) } });
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
    projectSuggestions(report.projectId).then(setSuggestions).catch(() => setSuggestions({ locations: [], companies: [] }));
  }, [report?.projectId]);

  function update(next: Report) {
    if (sending.current) return;
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

  const addCard = useCallback((kind?: ObservationType) => {
    const current = latest.current;
    // An inspection holds its checklist and nothing else.
    if (!current || current.state !== 'draft' || sending.current || reportTypeOf(current).checklist) return;
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

  /**
   * Removing is immediate, and saves like any edit, but Undo is offered for a
   * while. Undo puts back the same card or photograph, so the draft saves the
   * record it already had rather than a copy, and photographs that reached the
   * server are not sent again.
   */
  function removeCardNow(cardId: string) {
    const current = latest.current;
    if (!current || current.state !== 'draft' || sending.current) return;
    const number = current.observations.findIndex(o => o.id === cardId) + 1;
    const { observations, removed: item } = removeCard(current.observations, cardId, picking.includes(cardId));
    if (!item || item.kind !== 'card') return;
    setPicking(p => p.filter(x => x !== cardId));
    update({ ...current, observations });
    offerUndo(item, number, OBSERVATION_TYPES.find(t => t.value === item.card.type)?.short ?? item.card.type);
  }

  function removePhotoNow(cardId: string, photoId: string) {
    const current = latest.current;
    if (!current || current.state !== 'draft' || sending.current) return;
    const number = current.observations.findIndex(o => o.id === cardId) + 1;
    const { observations, removed: item } = removePhoto(current.observations, cardId, photoId);
    if (!item) return;
    update({ ...current, observations });
    offerUndo(item, number, '');
  }

  function offerUndo(item: Removed, cardNumber: number, kindLabel: string) {
    if (!canUndo(item)) { dismissUndo(); return; }
    const label = removedLabel(item, cardNumber, kindLabel);
    setRemoved({ item, ...label });
    setUndoSaid('');
    setTimeout(() => setUndoSaid(`${label.title}. ${label.detail}. Undo is focused.`), 100);
    holdUndo(false);
    // The Remove button pressed has gone, so focus goes to Undo rather than
    // the top of the page; while it is there the offer does not run out.
    requestAnimationFrame(() => undoButton.current?.focus({ preventScroll: true }));
  }

  /** Keep Undo on screen while it is being reached for; start the clock again once it is left. */
  function holdUndo(hold: boolean) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = hold ? null : setTimeout(() => setRemoved(null), UNDO_MS);
  }

  function dismissUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setRemoved(null);
    setUndoSaid('');
  }

  /** Closing the bar from the keyboard puts focus back on the cards rather than losing it. */
  function closeUndo() {
    dismissUndo();
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.eng-steps [aria-current="step"]')?.focus({ preventScroll: true }));
  }

  function undoRemove() {
    const current = latest.current;
    const item = removed?.item;
    // Not while sending: the offer stays as it is rather than vanishing unused.
    if (!item || !current || current.state !== 'draft' || sending.current) return;
    dismissUndo();
    const observations = restoreRemoved(current.observations, item);
    // Already back, or the photograph's card has gone since: nothing to save.
    if (!observations || observations === current.observations) return;
    if (item.kind === 'card' && item.picking) setPicking(p => [...p, item.card.id]);
    update({ ...current, observations });
    const cardId = item.kind === 'card' ? item.card.id : item.cardId;
    openCard(cardId);
    // Focus lands on what came back: its Remove button, which names it.
    const card = observations.findIndex(o => o.id === cardId) + 1;
    const name = item.kind === 'card' ? `Remove card ${card}` : `Remove photo ${(observations[card - 1]?.photos.findIndex(p => p.id === item.photo.id) ?? 0) + 1}`;
    // Photo numbers repeat across cards, so look only inside the restored card.
    const within = wide ? '#card-editor > div:not([hidden])' : `#slot-${CSS.escape(cardId)}`;
    // On the phone a card's Remove is at its foot, out of view, so focus goes to the card's row, which names it.
    const target = !wide && item.kind === 'card' ? `${within} .eng-cardrow` : `${within} [aria-label="${name}"]`;
    setTimeout(() => document.querySelector<HTMLElement>(target)?.focus({ preventScroll: true }), 50);
  }

  // The home screen's "Request a variation" lands here with the card already started.
  useEffect(() => {
    if (!report || report.state !== 'draft' || addedFromLink.current || reportTypeOf(report).checklist) return;
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
      const sent = await submitReport(saved, signatureTyped && !signatureImage
        // A typed signature is the name as typed: never filled in with the author's.
        ? { name: signerName.trim(), typed: true }
        : { ...(signatureImage ? { dataUrl: signatureImage } : {}), name: signerName.trim() || report.author });
      if (principalId) await releaseIfCurrent(report.id, principalId, seq.current);
      announce(sent, 'sent');
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
        <div className="empty" style={{ marginTop: 32 }} role="status">{waitingForHeld ? 'Putting the work from this phone onto the server first…' : 'Loading'}</div>
      </main>
    );
  }

  const project = report.projectSnapshot ?? getProject(report.projectId);
  const findings = reviewReport(report);
  const stop = findings.filter((f) => f.blocking);
  // An inspection just started has every check unanswered: one line for them
  // all, opening the first, rather than a dozen identical stops.
  const unansweredStops = stop.filter(f => f.field === 'answer');
  const stopRows = unansweredStops.length > 1
    ? stop.flatMap(f => f.field !== 'answer' ? [f] : f === unansweredStops[0] ? [{ ...f, message: `${unansweredStops.length} checks not answered yet` }] : [])
    : stop;
  const note = findings.filter((f) => !f.blocking);
  const sent = report.state === "submitted";
  const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);
  const mine = principal ? ownsReport(principal, report) : false;
  const counts = Object.fromEntries(KINDS.map(k => [k, report.observations.filter(o => o.type === k).length])) as Record<ObservationType, number>;
  const type = reportTypeOf(report);
  /** An inspection: fixed checks, answered one by one, rather than cards the engineer adds. */
  const checklist = Boolean(type.checklist);
  const answers = checkCounts(report.observations);
  const unanswered = report.observations.filter(o => o.type === 'check' && !o.check?.answer);
  /** The next check after `index` still to answer, going round to the start. */
  const nextUnanswered = (index: number) => [...report.observations.slice(index + 1), ...report.observations.slice(0, index)].find(o => o.type === 'check' && !o.check?.answer);
  // The open card. Side by side there is always one in the editor column; on
  // the phone every card starts folded, so the report reads as a short list.
  // An inspection opens at the first check still to answer.
  const open = report.observations.some(o => o.id === selectedSection) ? selectedSection
    : wide ? (checklist ? (unanswered[0] ?? report.observations[0])?.id ?? null : report.observations.at(-1)?.id ?? null) : null;
  const shortRef = report.reference.split('-').slice(1).join('-');
  // Where each card and photograph is. Offline means the server could not be
  // reached, so anything not yet on it is only on this phone.
  const offline = saveState === 'phone';
  const whereOf = new Map(report.observations.map(o => [o.id, cardWhere(o, onServer.cards[o.id], uploading, offline)]));
  // Removing a card or changing the signature also waits for a save, so the summary never goes green before it lands.
  const whereAll = reportWhere([...whereOf.values()], offline, {
    removed: Object.keys(onServer.cards).filter(cardId => !whereOf.has(cardId)).length,
    signature: report.state === 'draft' && signatureCopy(report) !== onServer.signature && !(onServer.signature === undefined && !report.draftSignature),
    noun: type.checklist ? 'check' : 'card',
  });
  const kindOf = (o: Observation) => OBSERVATION_TYPES.find(t => t.value === o.type);
  const extras = (o: Observation) => [o.affectedTrade && `Trade: ${o.affectedTrade}`, o.variationReason, o.workDone && 'already carried out', o.askedBy && `asked for by ${o.askedBy}`, o.roughSize && ({ 'half-day': 'about half a day', day: 'about a day', 'two-days': 'about two days', more: 'more than two days' })[o.roughSize], o.partsEstimate !== undefined && `parts about £${o.partsEstimate}`].filter(Boolean).join(' · ');

  /** Open a card on the cards step and bring it into view. */
  function openCard(cardId: string) {
    // Already open on this step, nothing renders: focus it now rather than leave a target for a later render.
    if (step === 'cards' && selectedSection === cardId) { focusNext.current = null; requestAnimationFrame(() => focusTarget(cardId)); }
    else focusNext.current = cardId;
    setSelectedSection(cardId);
    showCards();
    requestAnimationFrame(() => document.getElementById(wide ? 'card-editor' : `slot-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function showCheck() {
    if (step === 'check') return;
    focusNext.current = 'check';
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
    if (o.check) return checkRow(o, i);
    const k = kindOf(o);
    const stopped = stop.find(f => f.observationId === o.id);
    const choosing = picking.includes(o.id);
    const text = o.whatHappened.trim();
    const isOpen = open === o.id;
    return <button type="button" key={`row-${o.id}`} className={`eng-row eng-cardrow ${isOpen ? 'on' : ''} ${stopped ? 'late' : ''}`} aria-expanded={wide ? undefined : isOpen} aria-current={wide && isOpen ? 'true' : undefined} onClick={() => { if (!wide && isOpen) setSelectedSection(''); else openCard(o.id); }}>
      <span className="no">{String(i + 1).padStart(2, '0')}</span>
      <div className="main">
        <span className="top"><span className={`kind tone-${k?.tone ?? 'neutral'}`}>{choosing ? 'New' : k?.short ?? o.type}</span><b>{o.location.trim() || (choosing ? 'Choose a kind' : 'No location yet')}</b></span>
        {/* On the phone the open card shows its words and photos just below, so its row
            keeps only its heading and whether it is on the server yet. */}
        {!(isOpen && !wide) && <>
          <span className="desc">{choosing ? 'What kind of update is this?' : text || 'Nothing written yet'}</span>
          {!choosing && <span className="meta">{o.photos.length} photo{o.photos.length === 1 ? '' : 's'}{stopped ? <em> · {unlabelled(stopped.message, o)}</em> : null}</span>}
        </>}
        {/* Opened from a Stop, the card still says what stops it. */}
        {isOpen && !wide && !choosing && stopped && <span className="meta"><em>{unlabelled(stopped.message, o)}</em></span>}
        {!choosing && <CardWhereLine where={whereOf.get(o.id)} />}
      </div>
      {!wide && <span className="chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>}
    </button>;
  };

  /** One check folded to a line: its answer, the question, and what was written. */
  const checkRow = (o: Observation, i: number) => {
    const answer = CHECK_ANSWERS.find(a => a.value === o.check?.answer);
    const stopped = stop.find(f => f.observationId === o.id);
    const isOpen = open === o.id;
    const text = o.whatHappened.trim();
    return <button type="button" key={`row-${o.id}`} className={`eng-row eng-cardrow eng-checkrow ${isOpen ? 'on' : ''} ${stopped && answer ? 'late' : ''}`} aria-expanded={wide ? undefined : isOpen} aria-current={wide && isOpen ? 'true' : undefined} onClick={() => { if (!wide && isOpen) setSelectedSection(''); else openCard(o.id); }}>
      <span className="no">{String(i + 1).padStart(2, '0')}</span>
      <div className="main">
        <span className="top"><span className={`kind answer-${answer?.tone ?? 'open'}`}>{answer?.short ?? 'To do'}</span><b>{o.check?.question}</b></span>
        {isOpen && !wide && stopped && answer && <span className="meta"><em>{stopped.message.slice((o.check?.question ?? '').length + 2)}</em></span>}
        {!(isOpen && !wide) && (text || o.photos.length > 0 || (stopped && answer)) && <span className="meta">{text ? text : ''}{text && o.photos.length ? ' · ' : ''}{o.photos.length ? `${o.photos.length} photo${o.photos.length === 1 ? '' : 's'}` : ''}{stopped && answer ? <em>{text || o.photos.length ? ' · ' : ''}{stopped.message.slice((o.check?.question ?? '').length + 2)}</em> : null}</span>}
        {(answer || o.photos.length > 0) && <CardWhereLine where={whereOf.get(o.id)} />}
      </div>
      {!wide && <span className="chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>}
    </button>;
  };

  /** An open check: the question and its answers, then a step on to the next one still to answer. */
  const checkBody = (observation: Observation, index: number) => {
    const next = nextUnanswered(index);
    return <>
      <CheckEditor
        observation={observation}
        index={index}
        total={report.observations.length}
        hint={checkHint(type, observation.check?.item ?? '')}
        raises={type.raisesRecords}
        actionPrompt={type.actionPrompt ?? 'What has to happen'}
        locations={suggestions.locations}
        companies={suggestions.companies}
        photoWhere={(photoId) => { const w = whereOf.get(observation.id); const at = observation.photos.findIndex(p => p.id === photoId); return w && at >= 0 ? w.each[at] : undefined; }}
        // Held open by choice once touched: the default (first one unanswered) moves on as soon as it is answered.
        onChange={(changed) => { setSelectedSection(changed.id); update({ ...report, observations: report.observations.map((o) => (o.id === changed.id ? changed : o)) }); }}
        onRemovePhoto={(photoId) => removePhotoNow(observation.id, photoId)}
      />
      {observation.check?.answer && <div className="eng-card-actions">
        {next
          ? <button type="button" className="eng-next-check" onClick={() => openCard(next.id)}>Next check &rarr;<small>{unanswered.length} to answer</small></button>
          : <button type="button" className="eng-review-link" onClick={() => showCheck()}>All answered · check &amp; sign &rarr;</button>}
      </div>}
    </>;
  };

  /** The open card's questions, or the kind picker for a card that has none yet. */
  const cardBody = (observation: Observation, index: number) => observation.check ? checkBody(observation, index) : picking.includes(observation.id)
    ? <KindPicker onPick={k => { setPicking(p => p.filter(x => x !== observation.id)); const copy: Observation = { ...observation, type: k }; if (k === 'defect' && principal?.trade) copy.affectedTrade = principal.trade; update({ ...report, observations: report.observations.map(o => o.id === observation.id ? copy : o) }); }} />
    : <>
        <ObservationEditor
          observation={observation}
          index={index}
          folded={!wide}
          openIssues={projectIssues}
          locations={suggestions.locations}
          companies={suggestions.companies}
          photoWhere={(photoId) => { const w = whereOf.get(observation.id); const at = observation.photos.findIndex(p => p.id === photoId); return w && at >= 0 ? w.each[at] : undefined; }}
          onChange={(next) => update({ ...report, observations: report.observations.map((o) => (o.id === next.id ? next : o)) })}
          onRemove={() => removeCardNow(observation.id)}
          onRemovePhoto={(photoId) => removePhotoNow(observation.id, photoId)}
        />
        <div className="eng-card-actions">
          {observation.location.trim() && <button type="button" className="eng-same-place" onClick={() => addAtSameLocation(observation.id)} disabled={submitting}>
            <span>+ Another card here</span><small>{observation.location.trim()}</small>
          </button>}
          {wide
            ? <button type="button" onClick={() => addCard()} disabled={submitting}>+ Add another card</button>
            : <button type="button" className="eng-done" onClick={() => { setSelectedSection(''); requestAnimationFrame(() => document.getElementById(`slot-${observation.id}`)?.scrollIntoView({ block: 'nearest' })); }}>Done with this card</button>}
          {/* "Check & send" is always in the action bar below, so the card does not offer it a second time. */}
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
    <span className="find-kind">{kind === 'stop' ? 'Stop' : 'Optional'}</span>
    <span>{f.message}</span>
  </button>);

  return (
    <main className={sent ? "wrap eng-page eng-report-sent" : "wrap wrap-pad eng-report-editor"}>
      <PageTitle title={sent ? report.reference : 'Site update'} />
      <Link href={safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(report.projectId)}`)} className="back">
        &larr; {returnTo && viewName(safeViewReturn(returnTo, '')) ? backLabel(safeViewReturn(returnTo, '')) : project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1>{sent ? report.reference : type.name}</h1>
          {/* The tag says draft or sent, and a correction's note says which revision, so the line under the title does not repeat them. */}
          <p className="sub">{sent ? type.name : <span className="ref">{report.reference}</span>} · {project?.projectName}</p>
        </div>
        <span className={sent ? "tag tag-sent" : "tag tag-draft"}>{sent ? "Sent" : report.corrects ? `Correction draft` : "Draft"}</span>
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

      {sent && sentAway && mine && <SentElsewhere sent={report} work={sentAway.work} unheld={unheld} busy={handingOff} error={handoffError} errorLink={handoffLink}
        reason={handoffReason} onReason={setHandoffReason} onCorrect={correctWithChanges} onDiscard={discardSentAway} />}

      {sent && (
        <div className={`note ${report.review === "returned" ? "note-bad" : "note-ok"}`} style={{ marginTop: 16 }}>
          {report.review === "returned" && (
            <p style={{ margin: "0 0 8px" }}>
              <strong>Sent back by {report.reviewedBy ?? "the office"}.</strong> {report.reviewNote}
            </p>
          )}
          <p style={{ margin: 0 }}>
            Received by Relay {fmtWhen(report.serverAcknowledgedAt)}. It can no longer be edited — a correction is issued as a new revision.{" "}
            <Link href={withViewReturn(`/reports/${report.id}/preview`, safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(report.projectId)}`))} style={{ color: "var(--brass)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              View the document &rarr;
            </Link>
          </p>
          {/* Each step after sending, the same steps the office sees. */}
          <SubmissionStages report={report} tagClass={toneClass} when={fmtWhen} />
          {mine && !correcting && !sentAway && (
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
        <div className="sec"><h2 className="lbl">{checklist ? `${type.name} · ${answers.action} action${answers.action === 1 ? '' : 's'}` : `${report.observations.length} card${report.observations.length === 1 ? '' : 's'}`} · {photos} photograph{photos === 1 ? '' : 's'}</h2></div>
        {checklist ? report.observations.map((o, i) => { const action = o.check?.answer === 'action'; return <section key={o.id} className={`eng-sent-card ${action ? 'tone-defect' : 'tone-neutral'}`}>
          <div className="head"><h3 className="lbl">Check {String(i + 1).padStart(2, '0')}</h3><span className={`kind answer-${o.check?.answer ?? 'open'}`}>{CHECK_ANSWERS.find(a => a.value === o.check?.answer)?.label ?? 'Not answered'}</span></div>
          <p><b>{o.check?.question}</b>{o.location.trim() ? <> · {o.location}</> : null}{o.whatHappened.trim() ? <><br />{o.whatHappened}</> : null}</p>
          {(o.actionNeeded.trim() || o.owner.trim()) && <small>{o.actionNeeded.trim() && `Action: ${o.actionNeeded}`}{o.actionNeeded.trim() && o.owner.trim() && ' · '}{o.owner.trim() && `For: ${o.owner}`}</small>}
          {o.photos.length > 0 && <small>{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}</small>}
        </section>; }) : report.observations.length === 0 ? <div className="empty">No updates were recorded on this visit.</div> : report.observations.map((o, i) => { const k = kindOf(o); return <section key={o.id} className={`eng-sent-card tone-${k?.tone ?? 'neutral'}`}>
          <div className="head"><h3 className="lbl">Card {String(i + 1).padStart(2, '0')} · {o.location || 'No location'}</h3><span className={`kind tone-${k?.tone ?? 'neutral'}`}>{k?.short ?? o.type}</span></div>
          <p>{o.whatHappened}</p>
          {(o.actionNeeded.trim() || o.owner.trim()) && <small>{o.actionNeeded.trim() && `Action: ${o.actionNeeded}`}{o.actionNeeded.trim() && o.owner.trim() && ' · '}{o.owner.trim() && `For: ${o.owner}`}</small>}
          {extras(o) && <small>{extras(o)}</small>}
          {o.photos.length > 0 && <small>{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}</small>}
        </section>; })}
      </> : conflict ? <DraftConflict key={conflict.version} here={report} there={conflict} base={conflictBase} unheld={unheld} saving={submitting} onSave={resolveConflict} /> : <>
        {/* Two steps, so the cards and the final check never compete for the
            same scroll: build the report, then check, sign and send it. */}
        <nav className="eng-steps" aria-label="Report steps">
          <button type="button" aria-current={step === 'cards' ? 'step' : undefined} onClick={() => showCards()}><span className="n">1</span>{checklist ? 'Checks' : 'Cards'}<small>{checklist ? `${report.observations.length - unanswered.length}/${report.observations.length}` : report.observations.length}</small></button>
          <button type="button" aria-current={step === 'check' ? 'step' : undefined} onClick={() => showCheck()}><span className="n">2</span>Check &amp; send{stopRows.length > 0 && <small className="late">{stopRows.length}<span className="eng-sr"> {stopRows.length === 1 ? 'thing stops' : 'things stop'} it being sent</span></small>}</button>
        </nav>

        {step === 'cards' && (wide ? <div className="eng-editor-grid">
          <aside className="eng-rail" aria-label={checklist ? 'Checks in this inspection' : 'Cards in this update'}>
            <div className="eng-section-title" style={{ margin: 0 }}><h2>{checklist ? 'Checks' : 'Cards'}</h2><span className="r">{checklist ? `${report.observations.length - unanswered.length} of ${report.observations.length} answered` : report.observations.length}</span></div>
            <div className="eng-list">
              {report.observations.length === 0 && <div className="eng-empty">No cards yet. Add one for each thing you did, found or need.</div>}
              {report.observations.map((o, i) => cardRow(o, i))}
            </div>
            {!checklist && <button type="button" className="eng-add" disabled={submitting} onClick={() => addCard()}>+ Add a card</button>}
            {findings.length > 0 && <div className="eng-finds"><span className="lbl">Before you send</span>{findingRows(stopRows, 'stop')}{findingRows(note.slice(0, 3), 'note')}</div>}
          </aside>
          <div id="card-editor" style={{ scrollMarginTop: 24 }}>
            {report.observations.length === 0 ? <KindPicker onPick={k => addCard(k)} /> : report.observations.map((o, i) => <div key={o.id} hidden={open !== o.id} data-card-body={o.id} tabIndex={-1} role="group" aria-label={`${o.check ? 'Check' : 'Card'} ${i + 1} of ${report.observations.length}`} className="eng-card-body">{cardBody(o, i)}</div>)}
          </div>
        </div> : <div className="eng-acc" id="card-editor">
          {/* On the phone each card folds to one summary row, and the open
              card unfolds under its own row rather than somewhere below. */}
          {report.observations.length > 0 && <h2 className="eng-sr">{checklist ? 'Checks' : 'Cards'}</h2>}
          {report.observations.length === 0 ? <KindPicker onPick={k => addCard(k)} /> : <div className="eng-list">
            {report.observations.map((o, i) => <div key={o.id} id={`slot-${o.id}`} className={`eng-slot ${open === o.id ? 'open' : ''}`}>
              {cardRow(o, i)}
              <div hidden={open !== o.id}>{cardBody(o, i)}</div>
            </div>)}
          </div>}
          {report.observations.length > 0 && !checklist && <button type="button" className="eng-add" disabled={submitting} onClick={() => addCard()}>+ Add a card</button>}
        </div>)}

        {step === 'check' && <div id="report-check" className="eng-check">
          <h2 id="report-check-title" className="eng-sr" tabIndex={-1}>Check and send</h2>
          {findings.length === 0 ? (
            <div className="note note-ok">Everything needed is here.</div>
          ) : (
            <div className="eng-finds">
              {/* Blocking omissions and things worth a look are separated: an
                  engineer should be stopped by a defect with no photograph, and
                  not stopped by a missing caption. */}
              {findingRows(stopRows, 'stop')}
              {findingRows(note, 'note')}
            </div>
          )}

          {whereAll.text && <p className={`eng-where eng-where-${whereAll.where}`} aria-live="polite"><span className={WHERE_DOT[whereAll.where]} />{whereAll.text}</p>}

          <div className="sec"><h2 className="lbl">{checklist ? 'In this inspection' : 'In this report'}</h2></div>
          {checklist ? <dl className="eng-sum">
            <div><dt>Satisfactory</dt><dd>{answers.ok}</dd></div>
            <div><dt>Action needed</dt><dd className={answers.action ? 'late' : ''}>{answers.action}<small>{answers.action ? (type.raisesRecords ? 'raise issues' : 'on the action list') : ''}</small></dd></div>
            <div><dt>Not applicable</dt><dd>{answers.na}</dd></div>
            <div><dt>To answer</dt><dd className={answers.open ? 'soon' : ''}>{answers.open}</dd></div>
          </dl> : <dl className="eng-sum">
            <div><dt>Progress</dt><dd>{counts.update}</dd></div>
            <div><dt>Defects</dt><dd className={counts.defect ? 'late' : ''}>{counts.defect}<small>{counts.defect ? 'raise issues' : ''}</small></dd></div>
            <div><dt>Variations</dt><dd className={counts.instruction ? 'soon' : ''}>{counts.instruction}<small>{counts.instruction ? 'raise VOs' : ''}</small></dd></div>
            <div><dt>Access</dt><dd>{counts.access}<small>{counts.access ? 'raise issues' : ''}</small></dd></div>
          </dl>}

          {checklist && <div className="eng-does">
            <span className="lbl">What sending does</span>
            <div className="eng-list" style={{ marginTop: 8 }}>
              {type.raisesRecords
                ? <div className="eng-row"><div className="main"><b>{answers.action ? `${answers.action} issue${answers.action === 1 ? '' : 's'} raised · not yet reviewed` : 'No issues to raise'}</b><span>{answers.action ? `${report.observations.some(o => o.check?.answer === 'action' && o.linkedIssueId) ? 'Linked ones add a sighting to the existing issue. ' : ''}Each action goes on the snag list with where it is, and is listed at the top of the PDF.` : 'Every check is satisfactory or does not apply: the area is ready to hand over.'}</span></div></div>
                : <div className="eng-row"><div className="main"><b>{answers.action ? `${answers.action} action${answers.action === 1 ? '' : 's'} listed on the inspection` : 'No actions to list'}</b><span>Printed at the top of the PDF with who is to do each one. Nothing is added to the issue register.</span></div></div>}
              <div className="eng-row"><div className="main"><b>Received the moment it lands</b><span>{project?.projectManager ?? 'The project manager'} is emailed when the mailbox is live; the office can read it straight away.</span></div></div>
            </div>
          </div>}

          {!checklist && report.observations.length > 0 && <div className="eng-does">
            <span className="lbl">What sending does</span>
            <div className="eng-list" style={{ marginTop: 8 }}>
              {counts.defect + counts.access > 0 && <div className="eng-row"><div className="main"><b>{counts.defect + counts.access} issue{counts.defect + counts.access === 1 ? '' : 's'} raised · not yet reviewed</b><span>{report.observations.filter(o => (o.type === 'defect' || o.type === 'access') && o.linkedIssueId).length ? 'Linked ones add a sighting to the existing issue. ' : ''}The office assigns them; you’ll see who and when on your home screen.</span></div></div>}
              {counts.instruction > 0 && <div className="eng-row"><div className="main"><b>{counts.instruction} variation{counts.instruction === 1 ? '' : 's'} raised · need a quote</b><span>{report.observations.some(o => o.type === 'instruction' && o.workDone) ? 'Marked as already done: the office gets the client’s sign-off before it is invoiced. ' : ''}The office prices it and puts it to the client.</span></div></div>}
              <div className="eng-row"><div className="main"><b>Received the moment it lands</b><span>{project?.projectManager ?? 'The project manager'} is emailed when the mailbox is live; the office can read it straight away.</span></div></div>
            </div>
          </div>}

          <div className="sec"><h2 className="lbl">Sign</h2></div>
          {type.signatureRequired && <p className="hint eng-sign-hint">An inspection is signed by the person who carried it out: draw your signature, or type your name if you can’t draw.</p>}

          <section className="panel">
            <div className="panel-body">
              <SignaturePad
                name={signerName}
                initialImage={signatureImage}
                onNameChange={(next) => updateSignature(next, signatureImage, signatureTyped)}
                onChange={(image) => updateSignature(signerName, image)}
                {...(type.signatureRequired ? {
                  typed: signatureTyped,
                  onTypedChange: (next: boolean) => updateSignature(signerName, null, next),
                  hint: 'A signature is required: it shows who carried out the inspection.',
                } : {})}
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
          {/* Said to a screen reader as it happens; the bar below is for the eye and hand. */}
          <span className="eng-undo-said" aria-live="polite">{undoSaid}</span>
          {removed && <div className="eng-undo" onFocus={() => holdUndo(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) holdUndo(false); }} onPointerEnter={() => holdUndo(true)} onPointerLeave={() => holdUndo(false)}>
            <span className="eng-undo-text"><b>{removed.title}</b><small>{removed.detail}</small></span>
            <button ref={undoButton} type="button" className="eng-undo-button" onClick={undoRemove} disabled={submitting}>Undo</button>
            <button type="button" className="eng-undo-close" onClick={closeUndo} aria-label="Dismiss">&times;</button>
          </div>}
          <div className="actionbar-inner">
            <span className="savestate" aria-live="polite">
              <span className={SAVE[saveState].dot} />
              {step === 'check' && stop.length > 0
                ? <span className="actionbar-warning"><b>{stopRows.length} {stopRows.length === 1 ? 'item needs' : 'items need'} attention</b><span>Tap one above to fix it</span></span>
                : <b>{SAVE[saveState].text || (step === 'check' ? 'Ready to send' : checklist ? `${report.observations.length - unanswered.length} of ${report.observations.length} answered` : `${report.observations.length} card${report.observations.length === 1 ? '' : 's'}`)}</b>}
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
