import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

import type { DocReport, DocTone } from "./types.js";
import { BRANDING } from "./branding.js";

/**
 * The issued document.
 *
 * Structure follows proposal section 6: identity, then the action and decision
 * summary, then numbered observations with their evidence. The summary is first
 * because it is what the recipient must act on; the narrative supports it.
 *
 * The layout takes its cue from a drawing rather than a letter. Observations sit
 * against a numbered gutter with a hairline rule, so the eye can run down the
 * left edge and find item four without reading anything — which is how these are
 * used on site, where somebody is looking for one item rather than reading front
 * to back.
 *
 * Unknown owners are labelled, never invented. That is the correction Appendix C
 * asks for and the one thing here that must not be tidied away.
 *
 * This package is compiled by tsc rather than by the web application's bundler.
 * That is not incidental: react-pdf's `render` prop takes a function, and a
 * function prop does not survive the web framework's server compilation — the
 * page-number element, and silently the whole footer with it, rendered off the
 * page. Keeping the renderer outside that compilation fixes it, and also puts it
 * where blueprint 0.3 says document work belongs: in a worker, not the web app.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.join(here, "..", "fonts");

/*
 * Fonts are bundled and registered from disk. Registering from a URL would put a
 * network call in the rendering path, and an issued document must render
 * identically in five years regardless of what a CDN is doing.
 */
Font.register({
  family: "PlexMono",
  fonts: [
    { src: path.join(fontDir, "IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "IBMPlexMono-Medium.ttf"), fontWeight: 500 },
  ],
});

Font.register({
  family: "Archivo",
  fonts: [
    { src: path.join(fontDir, "Archivo-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Archivo-Medium.ttf"), fontWeight: 500 },
    { src: path.join(fontDir, "Archivo-SemiBold.ttf"), fontWeight: 600 },
  ],
});

// Hyphenation off: breaking "containment" across a line reads as a typo in a
// technical document, and the measure is wide enough not to need it. The one
// exception is a run with no spaces longer than any real word (a circuit
// reference, a pasted link): unbroken it runs off the edge of the page. Such
// a run may break every LONG_RUN characters or so. The layout marks each
// break with a hyphen, as ordinary hyphenation does, so a break is never put
// next to a hyphen already in the text, where it would read as part of it.
// 20 rather than 24: a 24-character run at 9pt is wider than the summary's
// owner column, and ran 5pt into the margin.
const LONG_RUN = 20;
Font.registerHyphenationCallback((word) => {
  const chars = [...word];
  if (chars.length <= LONG_RUN) return [word];
  const parts: string[] = [];
  let rest = chars;
  while (rest.length > LONG_RUN) {
    let cut = LONG_RUN;
    while (cut > LONG_RUN / 2 && (rest[cut - 1] === "-" || rest[cut] === "-")) cut -= 1;
    parts.push(rest.slice(0, cut).join(""));
    rest = rest.slice(cut);
  }
  return [...parts, rest.join("")];
});

const INK = "#16171a";
const MUTED = "#4e5158";
// Labels, captions' dates and table heads are small, so their grey is dark
// enough to read in print: 5:1 on white, 4.6:1 on the wash behind table
// heads. It was #83868c, 3.6:1 and 3.3:1: too faint for 6pt type on paper.
const FAINT = "#6c6f75";
const RULE = "#d9d9d4";
const HAIR = "#eceae4";
const BRASS = "#8a6d1f";
const WASH = "#f6f5f1";
/* A trim rather than a slab: brass at a weight that frames without shouting. */
const BRASS_TRIM = "#cbb277";
const FLAG = "#a8532f";

/**
 * One colour per kind of update, used on the gutter rule and the type chip.
 *
 * Restrained on purpose: enough that a reader scanning the left edge can tell a
 * defect from a progress note, not so much that the document looks colour-coded.
 * The written label is always present, so nothing depends on colour alone.
 */
const TONES: Record<DocTone, { rule: string; ink: string }> = {
  neutral: { rule: "#c9c9c2", ink: "#6f7178" },
  defect: { rule: "#c2705a", ink: "#a8532f" },
  variation: { rule: "#c0a24a", ink: "#8a6d1f" },
  access: { rule: "#9aa6b8", ink: "#5b6b80" },
};

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    // Reserves room for the stamped footer; see FOOTER_HEIGHT in footer.ts.
    paddingBottom: 92,
    paddingHorizontal: 42,
    fontSize: 9,
    lineHeight: 1.55,
    color: INK,
    fontFamily: "Archivo",
  },

  masthead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoBox: {
    borderWidth: 1,
    borderColor: RULE,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WASH,
  },
  logoText: { fontSize: 7, letterSpacing: 1.8, color: FAINT, fontWeight: 500 },
  companyBlock: { alignItems: "flex-end" },
  companyName: { fontSize: 9, fontWeight: 600 },
  companyLine: { fontSize: 7, color: FAINT, lineHeight: 1.5 },

  titleRow: {
    marginTop: 18,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  /* The title takes the room the reference leaves, so a long project name
     wraps under itself instead of running into the reference or off the page. */
  titleMain: { flex: 1, paddingRight: 14 },
  titleSide: { flexShrink: 0, alignItems: "flex-end" },
  docKind: { fontSize: 7, letterSpacing: 2.2, color: BRASS, fontWeight: 600 },
  /*
   * The page's line height reached the title as a fixed 14pt, less than the
   * title's own 21pt, so a name long enough to wrap had its lines drawn over
   * each other. It has its own line height now. Its line box grows downward
   * by 11.25pt, which the negative margin takes back, so a title on one line
   * sits exactly where it always has and the rule under it is where it was.
   */
  docTitle: { fontSize: 21, fontWeight: 600, marginTop: 3, letterSpacing: -0.3, lineHeight: 1.2, marginBottom: -11.25 },
  // The reference is a code, so it is set as one.
  docRef: { fontSize: 13, fontFamily: "PlexMono", fontWeight: 500, letterSpacing: 0.2 },

  /* A draft says so where it cannot be missed, not in small print. */
  stamp: { borderWidth: 1, borderColor: FLAG, paddingVertical: 3, paddingHorizontal: 8, marginTop: 5 },
  stampText: { fontSize: 6.5, letterSpacing: 1.4, color: FLAG, fontWeight: 600 },

  /*
   * Title block.
   *
   * Ruled, not boxed. Six equal bordered cells gave the client's name the same
   * weight as the revision number and read like a spreadsheet; the fields are
   * not equally important and should not look it. So: one hairline top and
   * bottom, no cell borders, and columns proportioned to their content — the
   * client gets the room a company name needs, the revision gets what a single
   * digit needs.
   *
   * Codes and dates are set in mono with tabular figures, the same idiom the
   * application uses, so a reference reads as a reference rather than as prose.
   */
  /*
   * Title block: an aligned label/value table in two groups of three.
   *
   * The framed labels that suit a type chip did not survive being repeated six
   * times — a badge is one marker against a heading, whereas six frames in a
   * grid are six competing objects with ragged right edges and no hierarchy.
   * Here the label is a caption for a value beside it, so it sits in a fixed
   * column and lets the values line up, which is what makes a block of facts
   * scannable.
   */
  tb: { flexDirection: "row", marginTop: 14, borderTopWidth: 1, borderColor: RULE, paddingTop: 4 },
  tbGroup: { width: "50%", paddingRight: 18 },
  /** One thing inspected, across the full width under the title block. */
  tbWide: { width: "100%", paddingRight: 18 },
  /* From the top, not the baseline: the same place for a value on one line, and
     level with the first line, not the last, for a value on more than one. */
  tbRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: HAIR },
  /* Sized to its own text, not the column, so a short label is a small box. */
  /* Fixed width, so every value in the group starts on the same line. */
  tbLabel: { width: 92, paddingRight: 8, fontSize: 5.8, letterSpacing: 1.2, color: FAINT, fontWeight: 500 },
  tbValue: { flex: 1, fontSize: 9.5, fontWeight: 600, letterSpacing: -0.05 },
  tbCode: { flex: 1, fontSize: 9, fontFamily: "PlexMono", fontWeight: 500, letterSpacing: 0.2 },

  h2Row: { flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 10 },
  h2: { fontSize: 7.5, letterSpacing: 1.8, color: BRASS, fontWeight: 600 },
  h2Rule: { flex: 1, height: 1, backgroundColor: RULE, marginLeft: 10 },

  thead: {
    flexDirection: "row",
    backgroundColor: WASH,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: RULE,
  },
  th: { fontSize: 6, letterSpacing: 1.2, color: FAINT, paddingVertical: 6, paddingHorizontal: 8, fontWeight: 500 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR },
  td: { paddingVertical: 7, paddingHorizontal: 8, fontSize: 9 },
  cNo: { width: "8%", color: BRASS, fontWeight: 600 },
  cItem: { width: "26%", fontWeight: 500 },
  cAction: { width: "42%" },
  cOwner: { width: "24%" },
  unknown: { color: "#96562a" },
  cCheck: { width: "70%" },
  cResult: { width: "22%", fontWeight: 600 },
  resultAction: { color: FLAG },
  resultQuiet: { color: FAINT, fontWeight: 500 },

  obs: { flexDirection: "row", marginBottom: 16 },
  lead: { position: "relative" },
  /* Hung in the gutter: back across the body's padding, rule and the gutter. */
  leadNo: { position: "absolute", left: -44, top: 0 },
  gutter: { width: 30 },
  gutterNo: { fontSize: 12, fontWeight: 600, letterSpacing: 0.2 },
  obsBody: { flex: 1, borderLeftWidth: 2, paddingLeft: 12, paddingBottom: 4 },
  obsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 },
  // flex: 1 so a long title wraps short of the chip; shrinking alone let it run under the chip.
  obsTitle: { fontSize: 11.5, fontWeight: 600, flex: 1, paddingRight: 12, letterSpacing: -0.15 },
  /*
   * A box with the label centred in it, rather than text with padding.
   * Text sits on its own line box, so padding alone leaves it riding high;
   * a fixed-height container with centred content puts it in the middle of
   * the frame on both axes.
   */
  /*
   * Centred by padding and line height rather than by flex.
   *
   * A Text inside a View with justifyContent/alignItems centre does not render
   * at all here — the frame draws and the label disappears. Symmetric vertical
   * padding against a line height of 1 puts the text in the middle of the box
   * just as reliably, and actually shows it.
   */
  chip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4, flexShrink: 0 },
  chipText: { fontSize: 6, letterSpacing: 1.1, fontWeight: 500, textAlign: "center", lineHeight: 1 },
  narrative: { marginBottom: 7 },
  action: {
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: WASH,
    borderLeftWidth: 2,
    borderLeftColor: BRASS,
    color: MUTED,
  },
  actionLabel: { fontSize: 6, letterSpacing: 1.2, color: BRASS, fontWeight: 600, marginBottom: 2 },

  /* Fixed frames with the image contained, never cropped: the part cut off to
     fill a grid is the part somebody photographed. */
  figs: { flexDirection: "row", flexWrap: "wrap" },
  fig: { width: "48.5%", marginRight: "3%", marginBottom: 9 },
  figLast: { width: "48.5%", marginBottom: 9 },
  figFull: { width: "100%", marginBottom: 9 },
  img: { borderWidth: 1, borderColor: RULE, objectFit: "contain", backgroundColor: "#ffffff", height: 126 },
  imgFull: { borderWidth: 1, borderColor: RULE, objectFit: "contain", backgroundColor: "#ffffff", height: 192 },
  /* A riser shot top to bottom: in a 126pt frame it was a sliver a finger wide. */
  imgTall: { borderWidth: 1, borderColor: RULE, objectFit: "contain", backgroundColor: "#ffffff", height: 320 },
  capNo: { fontSize: 6, letterSpacing: 1.1, color: BRASS, marginTop: 4, fontWeight: 600 },
  cap: { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  capDate: { fontSize: 6.5, color: FAINT },

  signRow: { flexDirection: "row", marginTop: 8 },
  signCell: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 10, marginRight: 10 },
  signCellLast: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 10 },
  signLabelBox: {
    borderWidth: 1,
    borderColor: BRASS_TRIM,
    backgroundColor: WASH,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginBottom: 8,
  },
  signLabel: {
    fontSize: 6,
    letterSpacing: 1.2,
    color: BRASS,
    fontWeight: 500,
    textAlign: "center",
    lineHeight: 1,
  },
  /* Room for a wet signature. A drawn one occupies the same space. */
  signSpace: { height: 46, justifyContent: "flex-end" },
  signImage: { height: 42, objectFit: "contain" },
  signRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 5 },
  signName: { fontSize: 9, fontWeight: 600 },
  signMeta: { fontSize: 7, color: FAINT, marginTop: 2 },
  /* A typed signature sits where a drawing would, as the name typed. */
  signTyped: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  signStatement: { fontSize: 7, color: FAINT, marginTop: 3, lineHeight: 1.35 },

  /* A correction says which revision it replaces and why, under the title block. */
  correction: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: WASH,
    borderLeftWidth: 2,
    borderLeftColor: FLAG,
  },
  correctionLabel: { fontSize: 6, letterSpacing: 1.2, color: FLAG, fontWeight: 600, marginBottom: 2 },

  /* The tally above an inspection's results: the answer to "did it pass?" in one line. */
  tally: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  tallyItem: { marginRight: 16, fontSize: 9 },
  tallyCount: { fontWeight: 600 },

  /* Who is to act, under the action on a card, as in the summary table. */
  ownerLine: { marginTop: 3, fontSize: 8, color: MUTED },
  ownerLabel: { fontWeight: 600, color: INK },

  /* What an inspection found wrong, above the action it led to in Actions arising. */
  found: { fontSize: 8, color: MUTED, marginBottom: 3 },

});

/**
 * Width of a label box.
 *
 * react-pdf does not give a shrink-to-fit container the intrinsic width of its
 * text — the box collapsed to its padding and the label vanished — so the width
 * is computed instead.
 *
 * Uppercase Archivo runs a little over 0.7em per character. The estimate errs
 * generous on purpose: a box a couple of points too wide is invisible, whereas
 * one a point too narrow wraps a two-word label onto two lines and looks like
 * a mistake.
 */
function labelWidth(label: string, size: number, tracking: number): number {
  return Math.ceil(label.length * (size * 0.75 + tracking)) + 22;
}

function Field({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  /** Codes, references and dates are set in mono so they read as data. */
  code?: boolean;
}) {
  return (
    <View style={s.tbRow}>
      <Text style={s.tbLabel}>{label.toUpperCase()}</Text>
      <Text style={code ? s.tbCode : s.tbValue}>{value}</Text>
    </View>
  );
}

/*
 * Dates as RELAY writes them on screen (apps/web/lib/dates.ts), written out
 * from parts because Chromium and Node do not agree on the en-GB pattern.
 */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LONDON = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function dateParts(value: string): { year: number; month: number; day: number; time?: string } | undefined {
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendar) return { year: Number(calendar[1]), month: Number(calendar[2]), day: Number(calendar[3]) };
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return undefined;
  const p = Object.fromEntries(LONDON.formatToParts(at).map((x) => [x.type, x.value]));
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day), time: `${p.hour}:${p.minute}` };
}

/** "Monday 19 October 2026": long form, because the document is read by a client and not by a system. */
function formatVisitDate(value: string): string {
  const p = dateParts(value);
  if (!p) return value;
  return `${DAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]} ${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "19 Oct 2026", UK time: when a photograph was taken. */
const takenOn = (iso: string): string => {
  const p = dateParts(iso);
  return p ? `${p.day} ${MONTHS[p.month - 1]!.slice(0, 3)} ${p.year}` : "";
};

/** "19 Oct 2026, 16:32", UK time: a signature is dated to the minute it was sent. */
const signedWhen = (iso: string): string => {
  const p = dateParts(iso);
  return p ? `${takenOn(iso)}${p.time ? `, ${p.time}` : ""}` : "";
};

/** A lead taller than this (points) may break across pages rather than leave most of one empty. */
const LEAD_LIMIT = 360;

/**
 * Roughly how tall a card's title, words and action box are, in points, used
 * only to decide whether the lead is short enough to keep on one page. Each
 * typed line counts at least once (a list of flats is many short lines), at
 * about 95 characters a line at 9pt across the card, 60 for the 11.5pt title.
 * Errs tall: an estimate too low would keep together a lead longer than a
 * page, and the end of it would be lost.
 */
function leadHeight(o: { whatHappened: string; actionNeeded: string; owner: string; location: string; check?: { question: string } | undefined }): number {
  const title = titleHeight(o);
  const words = 7 + lines(o.whatHappened || "-", 95) * 14;
  // Label, the action itself, the owner line and the box's padding.
  const action = o.actionNeeded.trim() ? actionHeight(o) : 0;
  return title + words + action;
}

const lines = (text: string, perLine: number) =>
  text.trim().split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);

/**
 * Roughly how tall a card's action box is: label, action, owner line and
 * padding. The owner counts too: a box kept on one page that is taller than
 * a page runs under the footer and off the paper.
 */
function actionHeight(o: { actionNeeded: string; owner: string }): number {
  return 30 + lines(o.actionNeeded, 88) * 14 + lines(o.owner.trim() || "-", 95) * 13;
}

/** A card's title (where it is) longer than this many points may break across pages. */
const titleHeight = (o: Parameters<typeof itemTitle>[0]): number => 8 + lines(itemTitle(o), 60) * 18;

/**
 * The summary keeps each row on one page, so a cell longer than this is
 * shortened there, as "Found:" is, and points to the card that has it all.
 * Short text, line breaks and all, is printed as written.
 */
const SUMMARY_LIMIT = { item: 160, action: 400, owner: 160 } as const;
function summaryCell(text: string, limit: number, number: number): string {
  if (Array.from(text.trim()).length <= limit && text.trim().split("\n").length <= 6) return text.trim();
  return cutWithPointer(text, limit, number);
}

/** A caption longer than this many characters may part from its photograph. */
const CAPTION_LIMIT = 600;

/** The pixel size of a JPEG or PNG data URL, or undefined if it cannot be read. */
function imageSize(dataUrl: string): { width: number; height: number } | undefined {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return undefined;
  // The size is near the start of the file; 64 KB of it is ample.
  const bytes = Buffer.from(dataUrl.slice(comma + 1, comma + 1 + 87_384), "base64");
  if (bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1]!;
    // Start of frame (any kind but DHT, JPG and DAC) carries height, then width.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return undefined;
}

/**
 * How a photograph is framed. Most share a row of two. One far wider than
 * tall (a corridor panorama) or far taller than wide (a riser top to bottom)
 * takes a row of its own, or it is too small to read: a panorama at the
 * height it needs across the page, a tall one in a taller frame.
 */
type Framing = { kind: "pair" | "full" | "wide" | "tall"; height?: number };
const MEASURE = 469; // the card's width: page, less margins, gutter, rule and padding
function framing(dataUrl: string): Framing | undefined {
  const size = imageSize(dataUrl);
  if (!size || !size.width || !size.height) return undefined;
  const aspect = size.width / size.height;
  if (aspect >= 2.5) return { kind: "wide", height: Math.max(48, Math.round(MEASURE / aspect)) };
  if (aspect <= 0.4) return { kind: "tall" };
  return undefined;
}

const FOUND_LIMIT = 180;
/**
 * What was found wrong, for an inspection's Actions arising row: the notes
 * as written, or their opening words and a pointer to the full notes below
 * when they would make the row (which is kept on one page) too long.
 */
function foundLine(notes: string, number: number): string {
  return cutWithPointer(notes, FOUND_LIMIT, number);
}

/** `text` on one line, cut at a word near `limit` characters with a pointer to card `number`. */
function cutWithPointer(text: string, limit: number, number: number): string {
  // By character, so an emoji is never split in two.
  const chars = Array.from(text.trim().replace(/\s+/g, " "));
  if (chars.length <= limit) return chars.join("");
  let cut = chars.slice(0, limit).join("");
  // End on a whole word: drop a part word, unless the cut fell between words.
  const space = cut.lastIndexOf(" ");
  if (chars[limit] !== " " && space > cut.length / 2) cut = cut.slice(0, space);
  return `${cut.replace(/[\s.,;:–—(\[{"'‘“…-]+$/, "")}… (see ${String(number).padStart(2, "0")} below)`;
}

/** A card is titled by where it is; a check by its question, and where, if the action says (a handover inspection's do). */
const itemTitle = (o: { location: string; check?: { question: string } | undefined }): string =>
  o.check ? `${o.check.question}${o.location.trim() ? ` · ${o.location.trim()}` : ""}` : o.location || "Location not recorded";

export function ReportDocument({ report }: { report: DocReport }) {
  const inspection = report.inspection === true;
  // Numbered by place in the whole report, so an inspection's check keeps the
  // number it has in the results table when only some are shown in detail,
  // and a row in the summary carries the number of the update it came from.
  const numbered = report.observations.map((observation, index) => ({ observation, number: index + 1 }));
  const actions = numbered.filter(({ observation: o }) =>
    o.check ? o.check.tone === "action" : o.actionNeeded.trim().length > 0 || o.typeLabel.toLowerCase() === "defect",
  );
  const tally = (["ok", "action", "na", "open"] as const)
    .map((tone) => ({
      tone,
      count: report.observations.filter((o) => (o.check?.tone ?? "open") === tone).length,
      label: { ok: "satisfactory", action: "action needed", na: "not applicable", open: "not answered" }[tone],
    }))
    .filter((t) => t.count > 0);
  const detailed = inspection
    ? numbered.filter(({ observation: o }) => o.check?.tone === "action" || o.whatHappened.trim() || o.photos.length > 0)
    : numbered;
  let figureNumber = 0;

  return (
    <Document
      title={`${report.documentTitle ?? "Site Progress Report"} ${report.reference} · ${report.projectName}`}
      author={BRANDING.companyName}
      subject={report.projectName}
    >
      <Page size="A4" style={s.page}>
        <View style={s.masthead}>
          {/* Sized to the space the real mark will need, so the layout is proven
              at the right proportions rather than against a gap. */}
          <View style={[s.logoBox, { width: BRANDING.logo.widthPt, height: BRANDING.logo.heightPt }]}>
            <Text style={s.logoText}>{BRANDING.logo.label}</Text>
          </View>

          <View style={s.companyBlock}>
            <Text style={s.companyName}>{BRANDING.companyName}</Text>
            {BRANDING.addressLines.map((line) => (
              <Text key={line} style={s.companyLine}>
                {line}
              </Text>
            ))}
            {BRANDING.registrationLines.map((line) => (
              <Text key={line} style={s.companyLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.titleRow}>
          <View style={s.titleMain}>
            <Text style={s.docKind}>{(report.documentTitle ?? "Site Progress Report").toUpperCase()}</Text>
            <Text style={s.docTitle}>{report.projectName}</Text>
          </View>
          <View style={s.titleSide}>
            <Text style={s.docRef}>{report.reference}</Text>
            {!report.approved && !report.submittedWithoutReview && (
              <View style={s.stamp}>
                <Text style={s.stampText}>DRAFT — NOT ISSUED</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.tb}>
          <View style={s.tbGroup}>
            <Field label="Client" value={report.clientName || "Not recorded"} />
            <Field label="Project number" value={report.projectNumber || "—"} code />
            <Field label="Client account" value={report.clientAccountNumber || "—"} code />
          </View>
          <View style={s.tbGroup}>
            <Field label={inspection ? "Inspection date" : "Visit date"} value={formatVisitDate(report.visitDate)} />
            <Field label={inspection ? "Inspected by" : "Prepared by"} value={report.author} />
            <Field label="Revision" value={String(report.revision)} code />
          </View>
        </View>
        {report.inspected && (
          <View style={s.tbWide}>
            <Field label={report.inspected.label} value={report.inspected.value} />
          </View>
        )}

        {report.correction ? (
          <View style={s.correction} wrap={lines(report.correction.reason, 95) * 14 + 24 > LEAD_LIMIT}>
            <Text style={s.correctionLabel}>
              {`REVISION ${report.revision} · REPLACES REVISION ${report.correction.replacesRevision}`}
            </Text>
            <Text>
              <Text style={s.ownerLabel}>Reason: </Text>
              {report.correction.reason}
            </Text>
          </View>
        ) : null}

        <View style={s.h2Row} minPresenceAhead={60}>
          <Text style={s.h2}>{inspection ? "ACTIONS ARISING" : "ACTION AND DECISION SUMMARY"}</Text>
          <View style={s.h2Rule} />
        </View>

        {actions.length === 0 ? (
          <Text style={s.narrative}>{report.observations.length === 0 ? "Nothing recorded yet. Cards added to the report show here." : inspection ? "No actions arise from this inspection." : "No actions or decisions arise from this visit."}</Text>
        ) : (
          <View>
            <View style={s.thead}>
              <Text style={[s.th, s.cNo]}>NO</Text>
              <Text style={[s.th, s.cItem]}>{inspection ? "CHECK" : "ITEM"}</Text>
              <Text style={[s.th, s.cAction]}>{inspection ? "ACTION REQUIRED" : "ACTION OR DECISION REQUIRED"}</Text>
              <Text style={[s.th, s.cOwner]}>OWNER</Text>
            </View>
            {actions.map(({ observation, number }) => (
              <View key={observation.id} style={s.tr} wrap={false}>
                <Text style={[s.td, s.cNo]}>{String(number).padStart(2, "0")}</Text>
                <Text style={[s.td, s.cItem]}>{summaryCell(itemTitle(observation), SUMMARY_LIMIT.item, number)}</Text>
                {inspection && observation.whatHappened.trim() ? (
                  <View style={[s.td, s.cAction]}>
                    <Text style={s.found}>
                      <Text style={s.ownerLabel}>Found: </Text>
                      {foundLine(observation.whatHappened, number)}
                    </Text>
                    <Text>{summaryCell(observation.actionNeeded, SUMMARY_LIMIT.action, number) || "To be determined"}</Text>
                  </View>
                ) : (
                  <Text style={[s.td, s.cAction]}>
                    {summaryCell(observation.actionNeeded, SUMMARY_LIMIT.action, number) || "To be determined"}
                  </Text>
                )}
                <Text style={observation.owner.trim() ? [s.td, s.cOwner] : [s.td, s.cOwner, s.unknown]}>
                  {summaryCell(observation.owner, SUMMARY_LIMIT.owner, number) || "Awaiting confirmation"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {inspection ? (
          <>
            {/* The heading, tally and first rows travel together, and the
                column heads repeat on each page the table runs onto. */}
            <View minPresenceAhead={150} />
            <View style={s.h2Row}>
              <Text style={s.h2}>INSPECTION RESULTS</Text>
              <View style={s.h2Rule} />
            </View>
            <View style={s.tally}>
              <Text style={s.tallyItem}>
                <Text style={s.tallyCount}>{report.observations.length}</Text> checks
              </Text>
              {tally.map((t) => (
                <Text key={t.tone} style={[s.tallyItem, t.tone === "action" ? s.resultAction : t.tone === "ok" ? {} : s.resultQuiet]}>
                  <Text style={s.tallyCount}>{t.count}</Text> {t.label}
                </Text>
              ))}
            </View>
            <View>
              <View style={s.thead} fixed>
                <Text style={[s.th, s.cNo]}>NO</Text>
                <Text style={[s.th, s.cCheck]}>CHECK</Text>
                <Text style={[s.th, s.cResult]}>RESULT</Text>
              </View>
              {numbered.map(({ observation, number }) => (
                <View key={observation.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.cNo]}>{String(number).padStart(2, "0")}</Text>
                  <Text style={[s.td, s.cCheck]}>{observation.check?.question ?? observation.location}</Text>
                  <Text style={[s.td, s.cResult, observation.check?.tone === "action" ? s.resultAction : observation.check?.tone === "ok" ? {} : s.resultQuiet]}>
                    {observation.check?.answer ?? observation.typeLabel}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {detailed.length > 0 ? (
          <View style={s.h2Row} minPresenceAhead={90}>
            <Text style={s.h2}>{inspection ? "NOTES AND PHOTOGRAPHS" : "UPDATES"}</Text>
            <View style={s.h2Rule} />
          </View>
        ) : null}

        {detailed.map(({ observation, number }) => {
          const single = observation.photos.length === 1;
          // Two to a row, from the left; a photograph framed on its own row starts the next pair afresh.
          let column = 0;
          const frames = observation.photos.map((photo) => {
            const framed = framing(photo.dataUrl);
            if (framed) { column = 0; return framed; }
            if (single) return { kind: "full" } as Framing;
            column = 1 - column;
            return { kind: "pair", last: column === 0 } as Framing & { last?: boolean };
          });
          const tone = observation.check ? (observation.check.tone === "action" ? TONES.defect : TONES.neutral) : TONES[observation.tone] ?? TONES.neutral;
          const chip = observation.check ? observation.check.answer : observation.typeLabel;
          return (
            <View key={observation.id} style={s.obs}>
              <View style={s.gutter} />

              <View style={[s.obsBody, { borderLeftColor: tone.rule }]}>
                {/*
                  The lead (number, title, words and action) is kept on one
                  page, so an action is never parted from what it is about.
                  The number hangs in the gutter from inside the lead, so it
                  moves with its card rather than staying on the page before.
                  Only a lead too long for one page is allowed to break.
                */}
                <View style={s.lead} wrap={leadHeight(observation) > LEAD_LIMIT}>
                  <Text style={[s.gutterNo, s.leadNo, { color: tone.ink }]}>{String(number).padStart(2, "0")}</Text>
                  <View style={s.obsHead} wrap={titleHeight(observation) > LEAD_LIMIT}>
                    <Text style={s.obsTitle}>{itemTitle(observation)}</Text>
                    <View style={[s.chip, { borderColor: tone.rule, width: labelWidth(chip, 6, 1.1) }]}>
                      <Text style={[s.chipText, { color: tone.ink }]}>{chip.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={s.narrative}>
                    {observation.whatHappened || (observation.check ? "No notes recorded." : "No description recorded.")}
                  </Text>

                  {observation.actionNeeded.trim() ? (
                    <View style={s.action} wrap={actionHeight(observation) > LEAD_LIMIT}>
                      <Text style={s.actionLabel}>ACTION REQUIRED</Text>
                      <Text>{observation.actionNeeded}</Text>
                      <Text style={s.ownerLine}>
                        <Text style={s.ownerLabel}>Owner: </Text>
                        {observation.owner.trim() || "Awaiting confirmation"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {observation.photos.length > 0 ? (
                  <View style={s.figs}>
                    {observation.photos.map((photo, photoIndex) => {
                      figureNumber += 1;
                      const frame = frames[photoIndex]! as Framing & { last?: boolean };
                      const style = frame.kind === "pair" ? (frame.last ? s.figLast : s.fig) : s.figFull;
                      const image =
                        frame.kind === "pair" ? s.img
                        : frame.kind === "tall" ? s.imgTall
                        : frame.kind === "wide" ? [s.imgFull, { height: Math.min(192, frame.height ?? 192) }]
                        : s.imgFull;
                      return (
                        <View key={photo.id} style={style} wrap={Array.from(photo.caption).length > CAPTION_LIMIT}>
                          <Image style={image} src={photo.dataUrl} />
                          <Text style={s.capNo}>PHOTOGRAPH {String(figureNumber).padStart(2, "0")}</Text>
                          <Text style={s.cap}>{photo.caption.trim() || "No caption recorded"}</Text>
                          <Text style={s.capDate}>Taken {takenOn(photo.capturedAt)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        {/* Heading and boxes as one, so "Sign off" never ends a page alone. */}
        <View wrap={false}>
        <View style={s.h2Row}>
          <Text style={s.h2}>SIGN OFF</Text>
          <View style={s.h2Rule} />
        </View>

        <View style={s.signRow}>
          <View style={s.signCell}>
            <View style={[s.signLabelBox, { width: labelWidth(inspection ? "INSPECTED BY" : "PREPARED BY", 6, 1.2) }]}>
              <Text style={s.signLabel}>{inspection ? "INSPECTED BY" : "PREPARED BY"}</Text>
            </View>
            <View style={s.signSpace}>
              {report.signature?.typed ? (
                <Text style={s.signTyped}>{report.signature.name}</Text>
              ) : report.signature?.dataUrl ? (
                <Image style={s.signImage} src={report.signature.dataUrl} />
              ) : null}
            </View>
            <View style={s.signRule} />
            <Text style={s.signName}>{report.signature?.name || report.author}</Text>
            <Text style={s.signMeta}>
              {report.signature?.typed
                ? `Typed signature · ${signedWhen(report.signature.signedAt)}${report.signature.signedInAs ? ` · signed in as ${report.signature.signedInAs}` : ""}`
                : report.signature?.dataUrl
                ? `Drawn signature · ${signedWhen(report.signature.signedAt)}`
                : report.signature
                ? `Sent without a drawn signature · ${signedWhen(report.signature.signedAt)}`
                : "Not signed yet"}
            </Text>
            {/* What the person ticked, word for word, so a typed signature says what it stands for. */}
            {report.signature?.typed && report.signature.statement ? (
              <Text style={s.signStatement}>“{report.signature.statement}”</Text>
            ) : null}
          </View>

          {/*
            Left blank for a wet signature on purpose. A typed name is not
            evidence of acceptance (proposal 6.1), so the document does not
            offer anywhere to type one.
          */}
          <View style={s.signCellLast}>
            <View style={[s.signLabelBox, { width: labelWidth("RECEIVED ON SITE BY", 6, 1.2) }]}>
              <Text style={s.signLabel}>RECEIVED ON SITE BY</Text>
            </View>
            <View style={s.signSpace} />
            <View style={s.signRule} />
            <Text style={s.signName}> </Text>
            <Text style={s.signMeta}>Name, company and date</Text>
          </View>
        </View>
        </View>

        {/* The footer is stamped after rendering — see footer.ts. The page's
            bottom padding reserves the space it occupies. */}
      </Page>
    </Document>
  );
}
