export type SortDirection = 'ascending' | 'descending';

const NATURAL = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

/** Natural text ordering with blank values kept at the bottom in either direction. */
export function sortTableRows<T>(rows: T[], direction: SortDirection, value: (row: T) => string, tie: (row: T) => string): T[] {
  return rows.sort((a, b) => {
    const left = value(a), right = value(b);
    if (!left || !right) {
      if (!left && !right) return NATURAL.compare(tie(a), tie(b));
      return !left ? 1 : -1;
    }
    const compared = NATURAL.compare(left, right) || NATURAL.compare(tie(a), tie(b));
    return direction === 'ascending' ? compared : -compared;
  });
}
