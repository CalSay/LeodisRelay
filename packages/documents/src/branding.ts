/**
 * Branding: the details printed on every report PDF, in one file so a change is
 * a single deliberate edit rather than a hunt through the layout.
 *
 * All of it is real, supplied by Cal on 22 Oct 2026. There is no VAT or company
 * number: a site report is not an invoice, and Cal asked why it would need one.
 */

export interface Branding {
  /** Trading name of the issuing company. */
  companyName: string;
  /** Company address, one line per element. */
  addressLines: string[];
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
  addressLines: ["Unit 3 Pool Business Park", "Pool Road", "Pool in Wharfedale", "Otley LS21 1FD"],
  logo: { widthPt: 82, heightPt: 50, file: "leodis-developments-logo.png" },
  accreditations: [
    { name: "CHAS Accreditation Standard", file: "accreditation-chas.png" },
    { name: "REFCOM F-Gas Certificated", file: "accreditation-refcom.png" },
    { name: "MCS Certified", file: "accreditation-mcs.png" },
    { name: "Gas Safe Register", file: "accreditation-gas-safe.png" },
  ],
};
