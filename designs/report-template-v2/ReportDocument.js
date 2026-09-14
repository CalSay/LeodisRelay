import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
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
const fontDir = path.resolve(here, "../../packages/documents/fonts");
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
const TONES = {
    neutral: { rule: "#c9c9c2", ink: "#6f7178" },
    defect: { rule: "#c2705a", ink: "#a8532f" },
    variation: { rule: "#c0a24a", ink: "#8a6d1f" },
    access: { rule: "#9aa6b8", ink: "#5b6b80" },
};
const s = StyleSheet.create({
    page: {
        paddingTop: 38,
        // Reserves room for the stamped footer; see FOOTER_HEIGHT in footer.ts.
        paddingBottom: 90,
        paddingHorizontal: 42,
        fontSize: 9.5,
        lineHeight: 1.4,
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
        marginTop: 12,
        paddingBottom: 11,
        borderBottomWidth: 2,
        borderBottomColor: BRASS,
        flexDirection: "column",
        alignItems: "stretch",
    },
    docKind: { fontSize: 7, letterSpacing: 2.2, color: BRASS, fontWeight: 600 },
    docTitle: { fontSize: 25, fontWeight: 600, marginTop: 3, letterSpacing: -0.3 },
    // The reference is a code, so it is set as one.
    docRef: { fontSize: 9, fontFamily: "PlexMono", fontWeight: 500, letterSpacing: 0.2 },
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
    tb: { flexDirection: "row", marginTop: 8 },
    tbGroup: { width: "50%", paddingRight: 18 },
    tbRow: { flexDirection: "row", alignItems: "baseline", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: HAIR },
    /* Sized to its own text, not the column, so a short label is a small box. */
    /* Fixed width, so every value in the group starts on the same line. */
    tbLabel: { width: 92, paddingRight: 8, fontSize: 7, letterSpacing: 0.15, color: FAINT, fontWeight: 500 },
    tbValue: { flex: 1, fontSize: 9.5, fontWeight: 600, letterSpacing: -0.05 },
    tbCode: { flex: 1, fontSize: 9, fontFamily: "PlexMono", fontWeight: 500, letterSpacing: 0.2 },
    h2Row: { flexDirection: "row", alignItems: "center", marginTop: 15, marginBottom: 8 },
    h2: { fontSize: 9, letterSpacing: 0.8, color: BRASS, fontWeight: 600 },
    h2Rule: { flex: 1, height: 1, backgroundColor: RULE, marginLeft: 10 },
    thead: {
        flexDirection: "row",
        backgroundColor: INK,
        borderTopWidth: 0,
        borderBottomWidth: 1,
        borderColor: RULE,
    },
    th: { fontSize: 6.5, letterSpacing: 0.4, color: "#ffffff", paddingVertical: 7, paddingHorizontal: 8, fontWeight: 500 },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR },
    td: { paddingVertical: 8, paddingHorizontal: 8, fontSize: 9 },
    cNo: { width: "8%", color: BRASS, fontWeight: 600 },
    cItem: { width: "26%", fontWeight: 500 },
    cAction: { width: "42%" },
    cOwner: { width: "24%" },
    unknown: { color: "#96562a" },
    obs: { marginBottom: 10, paddingTop: 7, borderTopWidth: 0.6, borderTopColor: RULE },
    gutter: { width: 34 },
    gutterNo: { fontSize: 19, fontWeight: 600, letterSpacing: 0.2 },
    obsBody: { width: 477, paddingLeft: 3, paddingBottom: 4 },
    obsHead: { marginBottom: 5 },
    obsTitle: { fontSize: 13, fontWeight: 600, flexShrink: 1, paddingRight: 12, letterSpacing: -0.15 },
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
    chip: { paddingBottom: 4 },
    chipText: { fontSize: 7, letterSpacing: 0.7, fontWeight: 600, lineHeight: 1.1 },
    narrative: { marginBottom: 7 },
    action: {
        marginBottom: 8,
        paddingTop: 2,
        color: MUTED,
    },
    actionLabel: { fontSize: 7, letterSpacing: 0.5, color: BRASS, fontWeight: 600, marginBottom: 2 },
    /* Fixed frames with the image contained, never cropped: the part cut off to
       fill a grid is the part somebody photographed. */
    figs: { flexDirection: "row", flexWrap: "wrap" },
    fig: { width: "48.5%", marginRight: "3%", marginBottom: 9 },
    figLast: { width: "48.5%", marginBottom: 9 },
    figFull: { width: "100%", marginBottom: 9 },
    img: { borderWidth: 1, borderColor: RULE, objectFit: "contain", backgroundColor: "#ffffff", height: 115 },
    imgFull: { borderWidth: 1, borderColor: RULE, objectFit: "contain", backgroundColor: "#ffffff", height: 160 },
    capNo: { fontSize: 6, letterSpacing: 1.1, color: BRASS, marginTop: 4, fontWeight: 600 },
    cap: { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
    capDate: { fontSize: 6.5, color: FAINT },
    signRow: { flexDirection: "row", marginTop: 4 },
    signCell: { width: "50%", paddingRight: 15, marginRight: 10 },
    signCellLast: { width: "50%", paddingLeft: 15 },
    signLabelBox: {
        paddingVertical: 2,
        marginBottom: 4,
    },
    signLabel: {
        fontSize: 7,
        letterSpacing: 0.5,
        color: BRASS,
        fontWeight: 500,
        textAlign: "left",
        lineHeight: 1,
    },
    /* Room for a wet signature. A drawn one occupies the same space. */
    signSpace: { height: 28, justifyContent: "flex-end" },
    signImage: { height: 29, objectFit: "contain" },
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
function labelWidth(label, size, tracking) {
    return Math.ceil(label.length * (size * 0.75 + tracking)) + 22;
}
function Field({ label, value, code, }) {
    return (_jsxs(View, { style: s.tbRow, children: [_jsx(Text, { style: s.tbLabel, children: label.toUpperCase() }), _jsx(Text, { style: code ? s.tbCode : s.tbValue, children: value })] }));
}
/** Long form, because the document is read by a client and not by a system. */
function formatVisitDate(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? iso
        : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
export function ReportDocument({ report }) {
    const actions = report.observations.filter((o) => o.actionNeeded.trim().length > 0 || o.typeLabel.toLowerCase() === "defect");
    let figureNumber = 0;
    return (_jsx(Document, { title: report.reference, author: BRANDING.companyName, subject: report.projectName, children: _jsxs(Page, { size: "A4", style: s.page, children: [_jsxs(View, { style: s.masthead, children: [_jsx(View, { style: [s.logoBox, { width: BRANDING.logo.widthPt, height: BRANDING.logo.heightPt }], children: _jsx(Text, { style: s.logoText, children: BRANDING.logo.label }) }), _jsxs(View, { style: s.companyBlock, children: [_jsx(Text, { style: s.companyName, children: BRANDING.companyName }), BRANDING.addressLines.map((line) => (_jsx(Text, { style: s.companyLine, children: line }, line))), BRANDING.registrationLines.map((line) => (_jsx(Text, { style: s.companyLine, children: line }, line)))] })] }), _jsxs(View, { style: s.titleRow, children: [_jsxs(View, { children: [_jsx(Text, { style: s.docKind, children: "SITE PROGRESS REPORT" }), _jsx(Text, { style: s.docTitle, children: report.projectName })] }), _jsxs(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 }, children: [_jsx(Text, { style: s.docRef, children: report.reference }), !report.approved && !report.submittedWithoutReview && (_jsx(View, { style: s.stamp, children: _jsx(Text, { style: s.stampText, children: "DRAFT \u2014 NOT ISSUED" }) }))] })] }), _jsxs(View, { style: s.tb, children: [_jsxs(View, { style: s.tbGroup, children: [_jsx(Field, { label: "Client", value: report.clientName || "Not recorded" }), _jsx(Field, { label: "Project number", value: report.projectNumber || "—", code: true }), _jsx(Field, { label: "Client account", value: report.clientAccountNumber || "—", code: true })] }), _jsxs(View, { style: s.tbGroup, children: [_jsx(Field, { label: "Visit date", value: formatVisitDate(report.visitDate) }), _jsx(Field, { label: "Prepared by", value: report.author }), _jsx(Field, { label: "Revision", value: String(report.revision), code: true })] })] }), _jsxs(View, { style: s.h2Row, minPresenceAhead: 60, children: [_jsx(Text, { style: s.h2, children: "ACTION AND DECISION SUMMARY" }), _jsx(View, { style: s.h2Rule })] }), actions.length === 0 ? (_jsx(Text, { style: s.narrative, children: "No actions or decisions arise from this visit." })) : (_jsxs(View, { children: [_jsxs(View, { style: s.thead, children: [_jsx(Text, { style: [s.th, s.cNo, { color: "#ffffff" }], children: "REF" }), _jsx(Text, { style: [s.th, s.cItem], children: "ITEM" }), _jsx(Text, { style: [s.th, s.cAction], children: "ACTION OR DECISION REQUIRED" }), _jsx(Text, { style: [s.th, s.cOwner], children: "OWNER" })] }), actions.map((observation, index) => (_jsxs(View, { style: s.tr, wrap: false, children: [_jsx(Text, { style: [s.td, s.cNo], children: String(report.observations.indexOf(observation) + 1).padStart(2, "0") }), _jsx(Text, { style: [s.td, s.cItem], children: observation.location || "Location not recorded" }), _jsx(Text, { style: [s.td, s.cAction], children: observation.actionNeeded.trim() || "To be determined" }), _jsx(Text, { style: observation.owner.trim() ? [s.td, s.cOwner] : [s.td, s.cOwner, s.unknown], children: observation.owner.trim() || "Awaiting confirmation" })] }, observation.id)))] })), _jsxs(View, { style: s.h2Row, minPresenceAhead: 60, children: [_jsx(Text, { style: s.h2, children: "UPDATES" }), _jsx(View, { style: s.h2Rule })] }), report.observations.map((observation, index) => {
                    const single = observation.photos.length === 1;
                    const tone = TONES[observation.tone] ?? TONES.neutral;
                    return (_jsxs(View, { style: s.obs, children: [_jsxs(View, { style: { flexDirection: "row" }, wrap: (observation.whatHappened.length + observation.actionNeeded.length) > 1800, children: [_jsx(View, { style: s.gutter, children: _jsx(Text, { style: [s.gutterNo, { color: tone.ink }], children: String(index + 1).padStart(2, "0") }) }), _jsxs(View, { style: [s.obsBody, { borderLeftColor: tone.rule }], children: [_jsxs(View, { style: s.obsHead, wrap: false, minPresenceAhead: 40, children: [_jsx(Text, { style: [s.chipText, { color: tone.ink, marginBottom: 4 }], children: observation.typeLabel.toUpperCase() }), _jsx(Text, { style: s.obsTitle, children: observation.location || "Location not recorded" })] }), _jsx(Text, { style: s.narrative, children: observation.whatHappened || "No description recorded." }), observation.actionNeeded.trim() ? (_jsxs(View, { style: s.action, children: [_jsx(Text, { style: s.actionLabel, minPresenceAhead: 24, children: "ACTION REQUIRED" }), _jsx(Text, { children: observation.actionNeeded }), _jsxs(Text, { style: { fontSize: 8, color: MUTED, marginTop: 4 }, children: ["Owner: ", observation.owner.trim() || "Awaiting confirmation"] })] })) : null] })] }), observation.photos.length > 0 ? (_jsx(View, { style: [s.figs, { marginLeft: 37 }], children: observation.photos.map((photo, photoIndex) => {
                                    figureNumber += 1;
                                    const style = single ? s.figFull : photoIndex % 2 === 1 ? s.figLast : s.fig;
                                    return (_jsxs(View, { style: style, wrap: false, children: [_jsx(Image, { style: single ? s.imgFull : s.img, src: photo.dataUrl }), _jsxs(Text, { style: s.capNo, children: ["UPDATE ", String(index + 1).padStart(2, "0"), " / PHOTOGRAPH ", String(figureNumber).padStart(2, "0")] }), _jsx(Text, { style: s.cap, children: photo.caption.trim() || "No caption recorded" }), _jsxs(Text, { style: s.capDate, children: ["Taken ", new Date(photo.capturedAt).toLocaleDateString("en-GB")] })] }, photo.id));
                                }) })) : null] }, observation.id));
                }), _jsxs(View, { wrap: false, children: [_jsxs(View, { style: [s.h2Row, { marginTop: 8, marginBottom: 5 }], children: [_jsx(Text, { style: s.h2, children: "SIGN OFF" }), _jsx(View, { style: s.h2Rule })] }), _jsxs(View, { style: s.signRow, wrap: false, children: [_jsxs(View, { style: s.signCell, children: [_jsx(View, { style: [s.signLabelBox, { width: labelWidth("PREPARED BY", 6, 1.2) }], children: _jsx(Text, { style: s.signLabel, children: "PREPARED BY" }) }), _jsx(View, { style: s.signSpace, children: report.signature?.dataUrl ? (_jsx(Image, { style: s.signImage, src: report.signature.dataUrl })) : null }), _jsx(View, { style: s.signRule }), _jsx(Text, { style: s.signName, children: report.signature?.name || report.author }), _jsx(Text, { style: s.signMeta, children: report.signature
                                                ? `Signed ${new Date(report.signature.signedAt).toLocaleDateString("en-GB")}`
                                                : "Not signed" })] }), _jsxs(View, { style: s.signCellLast, children: [_jsx(View, { style: [s.signLabelBox, { width: labelWidth("RECEIVED ON SITE BY", 6, 1.2) }], children: _jsx(Text, { style: s.signLabel, children: "RECEIVED ON SITE BY" }) }), _jsx(View, { style: s.signSpace }), _jsx(View, { style: s.signRule }), _jsx(Text, { style: s.signName, children: " " }), _jsx(Text, { style: s.signMeta, children: "Name, company and date" })] })] })] })] }) }));
}
