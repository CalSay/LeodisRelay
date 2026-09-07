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
// technical document, and the measure is wide enough not to need it.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#16171a";
const MUTED = "#4e5158";
const FAINT = "#83868c";
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
  docKind: { fontSize: 7, letterSpacing: 2.2, color: BRASS, fontWeight: 600 },
  docTitle: { fontSize: 21, fontWeight: 600, marginTop: 3, letterSpacing: -0.3 },
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
  tb: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, paddingTop: 12, paddingBottom: 2, borderTopWidth: 1, borderBottomWidth: 1, borderColor: RULE },
  tbCol: { paddingRight: 16, marginBottom: 14 },
  tbWide: { width: "44%" },
  tbMid: { width: "30%" },
  tbNarrow: { width: "26%" },
  /* Sized to its own text, not the column, so a short label is a small box. */
  tbLabelBox: {
    borderWidth: 1,
    borderColor: BRASS_TRIM,
    backgroundColor: WASH,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginBottom: 7,
  },
  tbLabel: {
    fontSize: 5.8,
    letterSpacing: 1.4,
    color: BRASS,
    fontWeight: 500,
    textAlign: "center",
    lineHeight: 1,
  },
  tbValue: { fontSize: 10.5, fontWeight: 600, letterSpacing: -0.1 },
  tbCode: { fontSize: 10, fontFamily: "PlexMono", fontWeight: 500, letterSpacing: 0.2 },

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

  obs: { flexDirection: "row", marginBottom: 16 },
  gutter: { width: 30 },
  gutterNo: { fontSize: 12, fontWeight: 600, letterSpacing: 0.2 },
  obsBody: { flex: 1, borderLeftWidth: 2, paddingLeft: 12, paddingBottom: 4 },
  obsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 },
  obsTitle: { fontSize: 11.5, fontWeight: 600, flexShrink: 1, paddingRight: 12, letterSpacing: -0.15 },
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
  chip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
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
  width,
  code,
}: {
  label: string;
  value: string;
  width: "wide" | "mid" | "narrow";
  /** Codes, references and dates are set in mono so they read as data. */
  code?: boolean;
}) {
  const w = width === "wide" ? s.tbWide : width === "mid" ? s.tbMid : s.tbNarrow;
  return (
    <View style={[s.tbCol, w]}>
      <View style={[s.tbLabelBox, { width: labelWidth(label, 5.8, 1.4) }]}>
        <Text style={s.tbLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={code ? s.tbCode : s.tbValue}>{value}</Text>
    </View>
  );
}

/** Long form, because the document is read by a client and not by a system. */
function formatVisitDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function ReportDocument({ report }: { report: DocReport }) {
  const actions = report.observations.filter(
    (o) => o.actionNeeded.trim().length > 0 || o.typeLabel.toLowerCase() === "defect",
  );
  let figureNumber = 0;

  return (
    <Document title={report.reference} author={BRANDING.companyName} subject={report.projectName}>
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
          <View>
            <Text style={s.docKind}>SITE PROGRESS REPORT</Text>
            <Text style={s.docTitle}>{report.projectName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.docRef}>{report.reference}</Text>
            {!report.approved && (
              <View style={s.stamp}>
                <Text style={s.stampText}>DRAFT — NOT ISSUED</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.tb}>
          <Field label="Client" value={report.clientName || "Not recorded"} width="wide" />
          <Field label="Project number" value={report.projectNumber || "—"} width="mid" code />
          <Field label="Client account" value={report.clientAccountNumber || "—"} width="narrow" code />
          <Field label="Visit date" value={formatVisitDate(report.visitDate)} width="wide" />
          <Field label="Prepared by" value={report.author} width="mid" />
          <Field label="Revision" value={String(report.revision)} width="narrow" code />
        </View>

        <View style={s.h2Row}>
          <Text style={s.h2}>ACTION AND DECISION SUMMARY</Text>
          <View style={s.h2Rule} />
        </View>

        {actions.length === 0 ? (
          <Text style={s.narrative}>No actions or decisions arise from this visit.</Text>
        ) : (
          <View>
            <View style={s.thead}>
              <Text style={[s.th, s.cNo]}>NO</Text>
              <Text style={[s.th, s.cItem]}>ITEM</Text>
              <Text style={[s.th, s.cAction]}>ACTION OR DECISION REQUIRED</Text>
              <Text style={[s.th, s.cOwner]}>OWNER</Text>
            </View>
            {actions.map((observation, index) => (
              <View key={observation.id} style={s.tr} wrap={false}>
                <Text style={[s.td, s.cNo]}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={[s.td, s.cItem]}>{observation.location || "Location not recorded"}</Text>
                <Text style={[s.td, s.cAction]}>
                  {observation.actionNeeded.trim() || "To be determined"}
                </Text>
                <Text style={observation.owner.trim() ? [s.td, s.cOwner] : [s.td, s.cOwner, s.unknown]}>
                  {observation.owner.trim() || "Awaiting confirmation"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.h2Row}>
          <Text style={s.h2}>UPDATES</Text>
          <View style={s.h2Rule} />
        </View>

        {report.observations.map((observation, index) => {
          const single = observation.photos.length === 1;
          const tone = TONES[observation.tone] ?? TONES.neutral;
          return (
            <View key={observation.id} style={s.obs}>
              <View style={s.gutter}>
                <Text style={[s.gutterNo, { color: tone.ink }]}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>

              <View style={[s.obsBody, { borderLeftColor: tone.rule }]}>
                <View style={s.obsHead} wrap={false}>
                  <Text style={s.obsTitle}>{observation.location || "Location not recorded"}</Text>
                  <View
                    style={[
                      s.chip,
                      { borderColor: tone.rule, width: labelWidth(observation.typeLabel, 6, 1.1) },
                    ]}
                  >
                    <Text style={[s.chipText, { color: tone.ink }]}>
                      {observation.typeLabel.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={s.narrative}>
                  {observation.whatHappened || "No description recorded."}
                </Text>

                {observation.actionNeeded.trim() ? (
                  <View style={s.action} wrap={false}>
                    <Text style={s.actionLabel}>ACTION REQUIRED</Text>
                    <Text>{observation.actionNeeded}</Text>
                  </View>
                ) : null}

                {observation.photos.length > 0 ? (
                  <View style={s.figs}>
                    {observation.photos.map((photo, photoIndex) => {
                      figureNumber += 1;
                      const style = single ? s.figFull : photoIndex % 2 === 1 ? s.figLast : s.fig;
                      return (
                        <View key={photo.id} style={style} wrap={false}>
                          <Image style={single ? s.imgFull : s.img} src={photo.dataUrl} />
                          <Text style={s.capNo}>
                            PHOTOGRAPH {String(figureNumber).padStart(2, "0")}
                          </Text>
                          <Text style={s.cap}>{photo.caption.trim() || "No caption recorded"}</Text>
                          <Text style={s.capDate}>
                            Taken {new Date(photo.capturedAt).toLocaleDateString("en-GB")}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={s.h2Row} wrap={false}>
          <Text style={s.h2}>SIGN OFF</Text>
          <View style={s.h2Rule} />
        </View>

        <View style={s.signRow} wrap={false}>
          <View style={s.signCell}>
            <View style={[s.signLabelBox, { width: labelWidth("PREPARED BY", 6, 1.2) }]}>
              <Text style={s.signLabel}>PREPARED BY</Text>
            </View>
            <View style={s.signSpace}>
              {report.signature?.dataUrl ? (
                <Image style={s.signImage} src={report.signature.dataUrl} />
              ) : null}
            </View>
            <View style={s.signRule} />
            <Text style={s.signName}>{report.signature?.name || report.author}</Text>
            <Text style={s.signMeta}>
              {report.signature
                ? `Signed ${new Date(report.signature.signedAt).toLocaleDateString("en-GB")}`
                : "Not signed"}
            </Text>
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

        {/* The footer is stamped after rendering — see footer.ts. The page's
            bottom padding reserves the space it occupies. */}
      </Page>
    </Document>
  );
}
