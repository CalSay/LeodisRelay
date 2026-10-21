/**
 * What the sign-in screen may say went wrong.
 *
 * The screen used to show whatever text arrived in `?error=`, so anyone could
 * send a link to RELAY's real address that put their own words in the red
 * box ("Your account is locked, ring this number"). Now the address carries a
 * short code and the words are RELAY's own. Microsoft's AADSTS number, when it
 * gives one, is kept: it is digits only and is what an administrator needs.
 */

export const SIGN_IN_ERRORS = {
  expired: 'That sign-in link has expired. Please try again.',
  'no-code': 'Microsoft did not return a sign-in code. Please try again.',
  role: 'Your account does not have the right RELAY access yet. Ask the office to sort it, then sign in again.',
  tenant: 'This account is not in the Leodis tenant. Sign in with your Leodis work account.',
  account: 'Microsoft did not return an account identifier. Please try again.',
  microsoft: 'Microsoft could not complete the sign-in. Please try again.',
  failed: 'Sign-in could not be completed. Please try again.',
} as const;

export type SignInErrorCode = keyof typeof SIGN_IN_ERRORS;

/** A refusal the sign-in screen can name. Any other failure reads as `failed`. */
export class SignInRefused extends Error {
  constructor(readonly code: SignInErrorCode) { super(SIGN_IN_ERRORS[code]); }
}

/** `/signin?error=role`, or `/signin?error=microsoft&ref=AADSTS50105` when Microsoft gave its number. */
export function signInErrorPath(code: SignInErrorCode, microsoftText?: string | null): string {
  const ref = /\bAADSTS\d{4,7}\b/.exec(microsoftText ?? '')?.[0];
  return `/signin?error=${code}${ref ? `&ref=${ref}` : ''}`;
}

/** The words for a code in the address. Unknown codes, and any old free text, get the general message. */
export function signInErrorMessage(code: string | undefined, ref?: string): string | null {
  if (!code) return null;
  const words = Object.prototype.hasOwnProperty.call(SIGN_IN_ERRORS, code) ? SIGN_IN_ERRORS[code as SignInErrorCode] : SIGN_IN_ERRORS.failed;
  return ref && /^AADSTS\d{4,7}$/.test(ref) ? `${words} (Microsoft reference ${ref})` : words;
}
