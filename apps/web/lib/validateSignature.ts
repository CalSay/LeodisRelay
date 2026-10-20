/** A drawn signature is a small PNG. Anything else is refused rather than stored. */
const SIGNATURE_LIMIT = 400_000;
export function invalidSignature(signature: unknown): string | null {
  if (signature === undefined || signature === null) return null;
  if (typeof signature !== 'object') return 'Malformed signature.';
  const { name, dataUrl, ...extra } = signature as Record<string, unknown>;
  if (Object.keys(extra).length || typeof name !== 'string' || name.length > 200) return 'Malformed signature.';
  if (dataUrl === undefined) return null;
  if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) return 'Malformed signature.';
  return dataUrl.length > SIGNATURE_LIMIT ? 'That signature is too large to save.' : null;
}
