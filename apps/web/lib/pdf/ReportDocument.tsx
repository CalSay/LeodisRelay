import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

import type { Report } from "../types";
import { OBSERVATION_TYPES, type FixtureProject } from "../fixtures";

/**
 * The issued document.
 *
 * ADR-04 proof. The gate is not whether a simple sample renders — it is whether
 * long paragraphs, varying photograph counts and orientations, absent optional
 * fields and page breaks all survive (proposal 11.2, Document quality). So this
 * is written to be exercised against awkward content rather than a tidy sample.
 *
 * Structure follows proposal section 6: identity, then the action and decision
 * summary, then numbered observations with their evidence. The summary is first
 * because it is what the recipient must act on; the narrative supports it.
 *
 * Unknown owners are labelled, never invented — the correction Appendix C asks
 * for.
 */

const INK = "#1a1a19";
const MUTED = "#55554e";
const FAINT = "#7a7a72";
const RULE = "#d8d8d2";
const BRASS = "#8a6d1f";

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: INK,
    fontFamily: "Helvetica",
  },

  brand: { fontSize: 8, letterSpacing: 2.4, color: BRASS, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, marginTop: 6, marginBottom: 14, fontFamily: "Helvetica-Bold" },
  headRule: { borderBottomWidth: 1.5, borderBottomColor: INK, marginBottom: 16 },

  // Title block: a grid of label/value cells, as a drawing carries.
  tb: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: RULE },
  tbCell: {
    width: "33.33%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: RULE,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  tbLabel: { fontSize: 6.5, letterSpacing: 1.1, color: FAINT, marginBottom: 2 },
  tbValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  h2: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: BRASS,
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 4,
    marginTop: 22,
    marginBottom: 10,
  },

  tableHead: { flexDirection: "row", backgroundColor: "#f2f2ed", borderBottomWidth: 1, borderBottomColor: RULE },
  th: { fontSize: 6.5, letterSpacing: 1.1, color: FAINT, paddingVertical: 5, paddingHorizontal: 7 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eaeae5" },
  td: { paddingVertical: 6, paddingHorizontal: 7, fontSize: 9 },
  cItem: { width: "30%" },
  cAction: { width: "45%" },
  cOwner: { width: "25%" },
  unknown: { color: "#8a5a2a", fontFamily: "Helvetica-Oblique" },

  obs: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#eaeae5" },
  obsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  obsTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", flexShrink: 1, paddingRight: 10 },
  obsType: {
    fontSize: 6.5,
    letterSpacing: 1,
    color: FAINT,
    borderWidth: 1,
    borderColor: RULE,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  body: { marginBottom: 6 },
  actionLine: { marginBottom: 6, color: MUTED },

  figs: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  fig: { width: "48%", marginRight: "2%", marginBottom: 10 },
  figFull: { width: "100%", marginBottom: 10 },
  /*
   * Fixed box height with the image contained inside it.
   *
   * Aspect ratio is preserved rather than cropped (proposal 6.1). Cropping to
   * fill a grid is unacceptable for evidence: the part cut off is exactly the
   * part somebody photographed. A portrait shot therefore letterboxes within
   * its box, and because every box is the same height the rows stay aligned
   * whatever mixture of orientations an engineer took.
   */
  img: {
    borderWidth: 1,
    borderColor: RULE,
    objectFit: "contain",
    backgroundColor: "#ffffff",
    height: 132,
  },
  imgFull: {
    borderWidth: 1,
    borderColor: RULE,
    objectFit: "contain",
    backgroundColor: "#ffffff",
    height: 232,
  },
  cap: { fontSize: 7.5, color: MUTED, marginTop: 3, lineHeight: 1.4 },
  capDate: { fontSize: 7, color: FAINT },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 6,
    fontSize: 7,
    color: FAINT,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tbCell}>
      <Text style={s.tbLabel}>{label.toUpperCase()}</Text>
      <Text style={s.tbValue}>{value}</Text>
    </View>
  );
}

export function ReportDocument({
  report,
  project,
}: {
  report: Report;
  project: FixtureProject | undefined;
}) {
  const actions = report.observations.filter(
    (o) => o.actionNeeded.trim().length > 0 || o.type === "defect",
  );
  let figureNumber = 0;

  return (
    <Document
      title={report.reference}
      author="Leodis"
      subject={project?.projectName ?? "Site progress report"}
    >
      <Page size="A4" style={s.page}>
        <View style={s.headRule}>
          <Text style={s.brand}>LEODIS</Text>
          <Text style={s.title}>Site Progress Report</Text>
        </View>

        <View style={s.tb}>
          <Cell label="Report" value={report.reference} />
          <Cell label="Project" value={project?.projectName ?? report.projectId} />
          <Cell label="Client" value={project?.clientName ?? "Not recorded"} />
          <Cell label="Visit date" value={report.visitDate} />
          <Cell label="Prepared by" value={report.author} />
          <Cell
            label="Revision"
            value={
              report.review === "approved"
                ? `${report.revision} — approved`
                : `${report.revision} — draft, not issued`
            }
          />
        </View>

        <Text style={s.h2}>ACTION AND DECISION SUMMARY</Text>
        {actions.length === 0 ? (
          <Text style={s.body}>No actions or decisions arise from this visit.</Text>
        ) : (
          <View>
            <View style={s.tableHead}>
              <Text style={[s.th, s.cItem]}>ITEM</Text>
              <Text style={[s.th, s.cAction]}>ACTION OR DECISION REQUIRED</Text>
              <Text style={[s.th, s.cOwner]}>OWNER</Text>
            </View>
            {actions.map((observation, index) => (
              <View key={observation.id} style={s.tr} wrap={false}>
                <Text style={[s.td, s.cItem]}>
                  {index + 1}. {observation.location || "Location not recorded"}
                </Text>
                <Text style={[s.td, s.cAction]}>
                  {observation.actionNeeded.trim() || "To be determined"}
                </Text>
                <Text
                  style={
                    observation.owner.trim() ? [s.td, s.cOwner] : [s.td, s.cOwner, s.unknown]
                  }
                >
                  {/* Inventing an owner to fill the column is what Appendix C corrects. */}
                  {observation.owner.trim() || "Awaiting confirmation"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>OBSERVATIONS</Text>
        {report.observations.map((observation, index) => {
          const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
          // One photograph carries at full width; several share rows. Important
          // evidence should not be shrunk to fit a grid that has nothing to
          // sit beside it.
          const full = observation.photos.length === 1;
          return (
            /*
             * Observations wrap. Forcing a whole block onto one page overflows
             * its own bounds when the text is long — narrative ran over the
             * photographs — and leaves large holes where a block jumps to the
             * next page. Individual figures still stay whole, so an image is
             * never split from its caption.
             */
            <View key={observation.id} style={s.obs}>
              <View style={s.obsHead} wrap={false}>
                <Text style={s.obsTitle}>
                  {index + 1}. {observation.location || "Location not recorded"}
                </Text>
                <Text style={s.obsType}>
                  {(type?.label ?? observation.type).toUpperCase()}
                </Text>
              </View>

              <Text style={s.body}>
                {observation.whatHappened || "No description recorded."}
              </Text>

              {observation.actionNeeded.trim() ? (
                <Text style={s.actionLine}>Action required: {observation.actionNeeded}</Text>
              ) : null}

              {observation.photos.length > 0 ? (
                <View style={s.figs}>
                  {observation.photos.map((photo) => {
                    figureNumber += 1;
                    return (
                      <View key={photo.id} style={full ? s.figFull : s.fig} wrap={false}>
                        <Image style={full ? s.imgFull : s.img} src={photo.dataUrl} />
                        <Text style={s.cap}>
                          Photograph {figureNumber}
                          {photo.caption.trim()
                            ? ` — ${photo.caption}`
                            : " — no caption recorded"}
                        </Text>
                        <Text style={s.capDate}>
                          Taken {new Date(photo.capturedAt).toLocaleDateString("en-GB")}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text>
            {report.reference} · Revision {report.revision} ·{" "}
            {report.review === "approved" ? "Approved for issue" : "Draft — not issued"}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
