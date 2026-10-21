import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { BRANDING } from "./branding.js";

/**
 * The page footer, stamped onto every page after rendering.
 *
 * Why a second pass rather than part of the document tree: react-pdf's
 * `position: absolute` + `fixed` footer renders correctly in isolation but
 * silently lands off the page in this document — present in the content stream,
 * absent from the paper. Several days of layout could be spent finding which
 * combination of styles provokes it.
 *
 * It is not worth that, because the footer is page furniture rather than
 * content: a fixed strip of marks, a rule, a reference and a page number, whose
 * position depends on the page and nothing else. Drawing it directly is
 * deterministic, immune to layout-engine behaviour, and takes the page count as
 * an input instead of needing a callback to discover it — which is the thing
 * that made the react-pdf version fragile in the first place.
 *
 * The document reserves space for it with the page's bottom padding. If that
 * padding and FOOTER_HEIGHT drift apart, content will collide with the footer,
 * so they are defined together here.
 */

/** Vertical space the footer occupies. The document must reserve at least this. */
export const FOOTER_HEIGHT = 70;

const MARGIN = 42;

const INK = rgb(0.306, 0.318, 0.345);
const FAINT = rgb(0.424, 0.435, 0.459); // #6c6f75, as the document's labels
const RULE = rgb(0.851, 0.851, 0.831);
const BOX = rgb(0.761, 0.761, 0.733);
const WASH = rgb(0.965, 0.961, 0.945);

export interface FooterText {
  /** Left-hand line: reference, revision and issue state. */
  left: string;
  /**
   * What the document is and which project, ahead of `left`: "Site Progress
   * Report · Tetley Hall Block E". Every page then says what it belongs to,
   * so a page printed or forwarded on its own is still identifiable.
   * Shortened with an ellipsis if it would run into the page number.
   */
  title?: string;
}

/** Letters with no accent to strip that still have an obvious plain form. */
const PLAIN: Record<string, string> = { "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ħ": "H", "ħ": "h", "ı": "i", "Ø": "O", "ø": "o" };

/** `text` cut to fit `width` at `size`, ending in an ellipsis when cut. */
function fitText(text: string, width: number, measure: (t: string) => number): string {
  if (measure(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && measure(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function stampFooter(pdf: Uint8Array, text: FooterText): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);

  /*
   * Standard Helvetica rather than the document's Archivo.
   *
   * fontkit cannot parse the static instances Google Fonts serves for Archivo,
   * and at 6-7pt in grey the difference is not perceptible on page furniture.
   * Embedding a second copy of the family to win an invisible distinction is
   * not worth the dependency or the file size.
   */
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const medium = await doc.embedFont(StandardFonts.HelveticaBold);

  // Standard Helvetica only has the WinAnsi characters; a project name with
  // anything else (a Polish place name, an emoji) would stop the stamp, so
  // those characters fall back to their plain letter, or are left out.
  const supported = new Set(regular.getCharacterSet());
  const encodable = (t: string): string =>
    [...t.normalize("NFC")].map((ch) => {
      if (supported.has(ch.codePointAt(0)!)) return ch;
      const plain = (PLAIN[ch] ?? ch.normalize("NFD")).replace(/[\u0300-\u036f]/g, "");
      return [...plain].every((c) => supported.has(c.codePointAt(0)!)) ? plain : "";
    }).join("").replace(/\s+/g, " ").trim();

  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const right = width - MARGIN;

    // Accreditation marks: outlined frames sized to the space a real mark needs,
    // so the layout is proven at the right proportions rather than at a gap.
    const label = "ACCREDITATIONS";
    const labelSize = 6;
    const labelWidth = medium.widthOfTextAtSize(label, labelSize) + label.length * 1.2;
    // Drawn a character at a time to get the letterspacing the label idiom uses
    // throughout the document; pdf-lib has no tracking option.
    let lx = MARGIN;
    for (const ch of label) {
      page.drawText(ch, { x: lx, y: 46, size: labelSize, font: medium, color: FAINT });
      lx += medium.widthOfTextAtSize(ch, labelSize) + 1.2;
    }

    const boxW = 74;
    const boxH = 26;
    let x = MARGIN + labelWidth + 10;
    for (let i = 0; i < BRANDING.accreditationCount; i += 1) {
      page.drawRectangle({
        x,
        y: 38,
        width: boxW,
        height: boxH,
        color: WASH,
        borderColor: BOX,
        borderWidth: 1,
        borderDashArray: [3, 2],
      });
      x += boxW + 7;
    }

    page.drawLine({
      start: { x: MARGIN, y: 30 },
      end: { x: right, y: 30 },
      thickness: 1,
      color: RULE,
    });

    const pageLabel = `Page ${index + 1} of ${total}`;
    const measure = (t: string) => regular.widthOfTextAtSize(t, 7);
    const separator = " · ";
    const left = encodable(text.left);
    const room = right - MARGIN - measure(pageLabel) - 18 - measure(left) - measure(separator);
    const line = text.title && room > 40 ? `${fitText(encodable(text.title), room, measure)}${separator}${left}` : left;
    page.drawText(line, { x: MARGIN, y: 20, size: 7, font: regular, color: INK });

    page.drawText(pageLabel, {
      x: right - regular.widthOfTextAtSize(pageLabel, 7),
      y: 20,
      size: 7,
      font: regular,
      color: INK,
    });
  });

  return doc.save();
}
