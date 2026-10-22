/**
 * Branding.
 *
 * The logo and accreditation marks are real (supplied by Cal on 22 Oct 2026).
 * The company details are stand-ins awaiting the real thing, collected in one
 * file with explicit TODOs so replacing them is a single deliberate change
 * rather than a hunt through the layout — and so nobody has to guess which
 * strings on the document are real.
 */

export interface Branding {
  /** TODO: registered trading name for the issuing company. */
  companyName: string;
  /** TODO: registered office address, one line per element. */
  addressLines: string[];
  /** TODO: company registration and VAT numbers. */
  registrationLines: string[];
  /**
   * The logo, as a file in packages/documents/assets. Width and height keep the
   * image's own proportions (640 × 389), so it is never stretched.
   */
  logo: { widthPt: number; heightPt: number; file: string };
  /**
   * The accreditation marks along the foot of every page, left to right, as
   * files in packages/documents/assets (the packs Cal supplied on 22 Oct 2026).
   * Each is drawn at the same height and its own width, so none is stretched.
   */
  accreditations: { name: string; file: string }[];
}

export const BRANDING: Branding = {
  companyName: "Leodis Developments Ltd",
  addressLines: ["Registered office address line 1", "Leeds", "LS0 0AA"],
  registrationLines: ["Company no. 00000000", "VAT no. GB 000 0000 00"],
  logo: { widthPt: 82, heightPt: 50, file: "leodis-developments-logo.png" },
  accreditations: [
    { name: "CHAS Accreditation Standard", file: "accreditation-chas.png" },
    { name: "REFCOM F-Gas Certificated", file: "accreditation-refcom.png" },
    { name: "MCS Certified", file: "accreditation-mcs.png" },
    { name: "Gas Safe Register", file: "accreditation-gas-safe.png" },
  ],
};
