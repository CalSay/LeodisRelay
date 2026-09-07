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
  },
];

export type ObservationType = "update" | "defect" | "instruction" | "access";

export const OBSERVATION_TYPES: {
  value: ObservationType;
  label: string;
  hint: string;
}[] = [
  { value: "update", label: "Progress update", hint: "Work carried out or progressed" },
  { value: "defect", label: "Defect", hint: "Something wrong that needs putting right" },
  { value: "instruction", label: "Instruction received", hint: "Someone told you to do something" },
  { value: "access", label: "Access restriction", hint: "You could not get to the work" },
];

export const FIXTURE_LOCATIONS = [
  "Level 1 - Riser",
  "Level 2 - Riser",
  "Level 3 - Riser",
  "Level 1 - Plant Room",
  "Roof - AHU Deck",
  "External - Compound",
];
