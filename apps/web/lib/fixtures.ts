/**
 * Synthetic fixture data, derived from the Kirkstall Gate example that
 * Appendix C makes the acceptance reference for the site progress template.
 *
 * Deliberately not generic filler: the point of testing against this data is
 * that it exercises the layouts and wording Leodis have already agreed to
 * produce. Long observation text, mixed photo counts, an unassigned action and
 * a pending handover are all here because each one is a case the real report
 * has to handle.
 *
 * All names, figures and dates are examples.
 */

export interface FixtureProject {
  id: string;
  projectNumber: string;
  projectName: string;
  clientName: string;
  clientAccountNumber: string;
  division: string;
  status: string;
  projectManager: string;
  /**
   * TODO: comes from the project list's Project Manager column, which is a
   * Person or Group and therefore carries a real address. These are examples.
   */
  projectManagerEmail: string;
  /** Whether a person must approve this project's reports before they issue. */
  reviewRequired: boolean;
}

/**
 * Statuses mirror the real list. Only "4. Active" and "5. Defects Liability"
 * are reportable, so the tender and the completed job below should never be
 * offered for capture — they are here precisely to prove that.
 */
export const FIXTURE_PROJECTS: FixtureProject[] = [
  {
    id: "proj-011lme",
    projectNumber: "011LME",
    projectName: "Tetley Hall - Block E",
    clientName: "C&AJ Marshall Builders Ltd",
    clientAccountNumber: "LCA0001",
    division: "Leodis M&E",
    status: "4. Active",
    projectManager: "A. Whitfield",
    projectManagerEmail: "a.whitfield@example.invalid",
    reviewRequired: false,
  },
  {
    id: "proj-014lme",
    projectNumber: "014LME",
    projectName: "Kirkstall Gate - Phase 2",
    clientName: "Northbank Construction Ltd",
    clientAccountNumber: "LCA0007",
    division: "Leodis M&E",
    status: "4. Active",
    projectManager: "A. Whitfield",
    projectManagerEmail: "a.whitfield@example.invalid",
    reviewRequired: false,
  },
  {
    id: "proj-009lcp",
    projectNumber: "009LCP",
    projectName: "Hunslet Depot - Welfare Block",
    clientName: "C&AJ Marshall Builders Ltd",
    clientAccountNumber: "LCA0001",
    division: "Leodis Commercial Plumbing",
    status: "5. Defects Liability",
    projectManager: "R. Ellison",
    projectManagerEmail: "r.ellison@example.invalid",
    reviewRequired: false,
  },
  {
    id: "proj-021lme",
    projectNumber: "021LME",
    projectName: "Aire Court - Mechanical Fit Out",
    clientName: "Verity Estates plc",
    clientAccountNumber: "LCA0019",
    division: "Leodis M&E",
    status: "1. Tender",
    projectManager: "A. Whitfield",
    projectManagerEmail: "a.whitfield@example.invalid",
    reviewRequired: false,
  },
  {
    id: "proj-004lcp",
    projectNumber: "004LCP",
    projectName: "Bramley Works - Plantroom",
    clientName: "Northbank Construction Ltd",
    clientAccountNumber: "LCA0007",
    division: "Leodis Commercial Plumbing",
    status: "6. Complete",
    projectManager: "R. Ellison",
    projectManagerEmail: "r.ellison@example.invalid",
    reviewRequired: false,
  },
];

export type ObservationType = "update" | "defect" | "instruction" | "access";

/**
 * The kinds of update an engineer can record.
 *
 * `tone` drives a consistent colour for each kind wherever it appears — the
 * capture screen, the register and the issued document — so a reader can tell
 * a defect from a progress note without reading the label. It is always paired
 * with the written label, never used alone.
 *
 * The stored values are unchanged from the first version. `instruction` reads
 * as "Variation required" now, but renaming the value as well would orphan
 * every record already captured for no benefit a reader can see.
 */
export type UpdateTone = "neutral" | "defect" | "variation" | "access";

export const OBSERVATION_TYPES: {
  value: ObservationType;
  label: string;
  hint: string;
  tone: UpdateTone;
}[] = [
  {
    value: "update",
    label: "Progress update",
    hint: "Work carried out or progressed",
    tone: "neutral",
  },
  {
    value: "defect",
    label: "Defect",
    hint: "Something wrong that needs putting right",
    tone: "defect",
  },
  {
    value: "instruction",
    label: "Variation required",
    hint: "Work outside the original scope, needing instruction",
    tone: "variation",
  },
  {
    value: "access",
    label: "Access restriction",
    hint: "You could not get to the work",
    tone: "access",
  },
];

export const FIXTURE_LOCATIONS = [
  "Level 1 - Riser",
  "Level 2 - Riser",
  "Level 3 - Riser",
  "Level 1 - Plant Room",
  "Roof - AHU Deck",
  "External - Compound",
];
