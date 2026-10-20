/**
 * Signing without drawing.
 *
 * An inspection is signed by the person who carried it out. Most draw their
 * signature, but someone using only a keyboard or a screen reader cannot, so
 * they may sign by typing their full name and ticking a statement instead.
 *
 * A typed signature is kept as traceable as a drawn one: it is only ever taken
 * from the author's own signed-in session (only the author can send), the
 * server records when it was signed and the exact words of the statement that
 * was ticked, and it is marked as typed everywhere it is shown, so the office
 * and the PDF never mistake it for a drawing. Must match TYPED_STATEMENT in
 * public/offline.js, where an inspection is signed with no signal
 * (tests/typedSignature.test.ts).
 */
export const TYPED_STATEMENT = 'I carried out this inspection and this record is accurate. Typing my name and ticking this box is my signature.';

/** A signature as the draft or a send carries it: drawn (`dataUrl`) or typed (`typed`), never both. */
export interface SignatureInput { name: string; dataUrl?: string; typed?: true }

/** Whether a draft or held signature signs it: a drawing, or a typed full name with the statement ticked. */
export const signs = (s: SignatureInput | null | undefined): boolean =>
  Boolean(s && (s.dataUrl || (s.typed && s.name.trim())));

/** How a sent signature reads beside the name: "drawn" or "typed". */
export const signatureMethod = (s: { dataUrl?: string; typed?: unknown }): 'drawn' | 'typed' | 'name only' =>
  s.typed ? 'typed' : s.dataUrl ? 'drawn' : 'name only';
