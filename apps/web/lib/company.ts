/** The company last picked on the hub ("developments" or "compliance"). Set by middleware.ts. */
export const COMPANY_COOKIE = 'relay-company';
export const COMPANIES = ['developments', 'compliance'] as const;
export type Company = typeof COMPANIES[number];

/** The company to open from the home screen icon, if one was picked before. */
export function rememberedCompany(value: string | undefined): Company | null {
  return COMPANIES.find(c => c === value) ?? null;
}
