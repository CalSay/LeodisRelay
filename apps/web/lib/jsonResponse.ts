import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const zip = promisify(gzip);

/** Smaller answers are sent as they are: compressing them saves less than it costs. */
export const COMPRESS_FROM = 8 * 1024;

/**
 * A JSON answer, gzipped when it is large and the browser accepts gzip. Next
 * compresses pages but not what an API route returns, so a busy project's
 * issue list went to a phone as several megabytes of plain text. JSON of
 * records repeats itself, so gzip makes it about a tenth of the size.
 * Compressed off the main thread, so other requests are not held up.
 */
export async function jsonResponse(request: Request, body: unknown, init: ResponseInit = {}): Promise<Response> {
  const text = JSON.stringify(body);
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.append('vary', 'Accept-Encoding');
  if (text.length < COMPRESS_FROM || !/\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '')) return new Response(text, { ...init, headers });
  headers.set('content-encoding', 'gzip');
  return new Response(new Uint8Array(await zip(text)), { ...init, headers });
}
