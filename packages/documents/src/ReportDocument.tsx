import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";

import type { DocReport } from "./types.js";
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
const FLAG = "#a8532f";

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
  docRef: { fontSize: 13, fontWeight: 600, letterSpacing: 0.4 },

  /* A draft says so where it cannot be missed, not in small print. */
  stamp: { borderWidth: 1, borderColor: FLAG, paddingVertical: 3, paddingHorizontal: 8, marginTop: 5 },
  stampText: { fontSize: 6.5, letterSpacing: 1.4, color: FLAG, fontWeight: 600 },

  tb: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: RULE,
    marginTop: 16,
  },
  tbCell: {
    width: "33.333%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: RULE,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tbLabel: { fontSize: 6, letterSpacing: 1.2, color: FAINT, marginBottom: 2, fontWeight: 500 },
  tbValue: { fontSize: 9.5, fontWeight: 600 },

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
  gutterNo: { fontSize: 12, fontWeight: 600, color: BRASS, letterSpacing: 0.2 },
  obsBody: { flex: 1, borderLeftWidth: 1, borderLeftColor: RULE, paddingLeft: 12, paddingBottom: 4 },
  obsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 },
  obsTitle: { fontSize: 11.5, fontWeight: 600, flexShrink: 1, paddingRight: 12, letterSpacing: -0.15 },
  chip: {
    fontSize: 6,
    letterSpacing: 1.1,
    color: FAINT,
    borderWidth: 1,
    borderColor: RULE,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    fontWeight: 500,
  },
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

});

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tbCell}>
      <Text style={s.tbLabel}>{label.toUpperCase()}</Text>
      <Text style={s.tbValue}>{value}</Text>
    </View>
  );
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
          <Cell label="Client" value={report.clientName || "Not recorded"} />
          <Cell label="Client account" value={report.clientAccountNumber || "—"} />
          <Cell label="Project number" value={report.projectNumber || "—"} />
          <Cell label="Visit date" value={report.visitDate} />
          <Cell label="Prepared by" value={report.author} />
          <Cell label="Revision" value={String(report.revision)} />
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
          <Text style={s.h2}>OBSERVATIONS</Text>
          <View style={s.h2Rule} />
        </View>

        {report.observations.map((observation, index) => {
          const single = observation.photos.length === 1;
          return (
            <View key={observation.id} style={s.obs}>
              <View style={s.gutter}>
                <Text style={s.gutterNo}>{String(index + 1).padStart(2, "0")}</Text>
              </View>

              <View style={s.obsBody}>
                <View style={s.obsHead} wrap={false}>
                  <Text style={s.obsTitle}>{observation.location || "Location not recorded"}</Text>
                  <Text style={s.chip}>{observation.typeLabel.toUpperCase()}</Text>
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

        {/* The footer is stamped after rendering — see footer.ts. The page's
            bottom padding reserves the space it occupies. */}
      </Page>
    </Document>
  );
}
