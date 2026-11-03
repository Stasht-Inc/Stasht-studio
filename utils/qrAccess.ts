// QR codes v2 (Chris, 3 Nov 2026 evening): a printed QR code opens /published-memory/<slug>?qr=<code> for whichever
// campaign the code points at now — published or not. The public campaign page (PublishedMemoryPage) passes that
// code to every API call it makes (the campaign, a linked campaign, comments, the view / click counters, "Add a
// moment"), and the web API grants Public access while the code still points at that campaign (checked on every
// request: re-pointing the code takes the old campaign's access away at once).
// Pure, so `node --test` loads it (tests/utils/qrAccess.test.mjs).

/** A QR code's public code as the short URLs carry it: letters and digits, at most 16. */
const QR_CODE_PATTERN = /^[A-Za-z0-9]{1,16}$/;

/** The page's ?qr= (a URLSearchParams, or a search string like "?qr=K7PQ2MZX"); null when absent or malformed. */
export function qrFromSearch(search: URLSearchParams | string | null | undefined): string | null {
  if (!search) return null;
  const params = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;
  const v = (params.get('qr') ?? '').trim();
  return QR_CODE_PATTERN.test(v) ? v : null;
}

/** path with &qr=<code> (or ?qr=) added; the path as it is without a well-formed code. */
export function withQr(path: string, qr: string | null | undefined): string {
  const code = typeof qr === 'string' ? qr.trim() : '';
  if (!QR_CODE_PATTERN.test(code)) return path;
  const hash = path.indexOf('#');
  const base = hash >= 0 ? path.slice(0, hash) : path;
  const tail = hash >= 0 ? path.slice(hash) : '';
  const sep = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?';
  return `${base}${sep}qr=${encodeURIComponent(code)}${tail}`;
}
