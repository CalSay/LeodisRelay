/**
 * Branding placeholders.
 *
 * Every value here is a stand-in awaiting the real thing, collected in one file
 * with explicit TODOs so replacing them is a single deliberate change rather
 * than a hunt through the layout — and so nobody has to guess which strings on
 * the document are real.
 *
 * The logo and accreditation marks are drawn as outlined boxes rather than
 * omitted. A placeholder that occupies the space it will eventually need proves
 * the layout works at the right proportions; leaving a gap means discovering at
 * the worst moment that the real mark does not fit.
 */

export interface Branding {
  /** TODO: registered trading name for the issuing company. */
  companyName: string;
  /** TODO: registered office address, one line per element. */
  addressLines: string[];
  /** TODO: company registration and VAT numbers. */
  registrationLines: string[];
  /** TODO: supply a logo image and render it in place of the outlined box. */
  logo: { widthPt: number; heightPt: number; label: string };
  /**
   * TODO: replace with the real accreditations and their marks. Sized as a row
   * of frames so the strip is laid out against the number Leodis actually
   * holds — typically Gas Safe, NICEIC, SafeContractor, CHAS, Constructionline
   * or ISO marks for an M&E contractor.
   */
  accreditationCount: number;
}

export const BRANDING: Branding = {
  companyName: "Leodis Developments Ltd",
  addressLines: ["Registered office address line 1", "Leeds", "LS0 0AA"],
  registrationLines: ["Company no. 00000000", "VAT no. GB 000 0000 00"],
  logo: { widthPt: 132, heightPt: 40, label: "LOGO" },
  accreditationCount: 4,
};
