/**
 * "SPR-9" before "SPR-10": the same order as `a.localeCompare(b, 'en', { numeric: true })`,
 * from one collator made once. localeCompare with options builds a new one on
 * every call, which is slow when a page sorts thousands of records.
 */
export const naturalOrder: (a: string, b: string) => number = new Intl.Collator('en', { numeric: true }).compare;
