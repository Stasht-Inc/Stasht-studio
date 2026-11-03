// QR codes v2 (Chris, 3 Nov 2026 evening): a printed QR code opens /published-memory/<slug>?qr=<code> for whichever
// campaign the code points at now — published or not. The public campaign page (PublishedMemoryPage) passes that
// code along: ?qr= on GET /published-memories and GET /memory-detail/{id} (linked campaigns), body qr on POST
// /memories/submit-photo ("Add a moment"), /memories/{id}/track-view and /memory-images/comments (the last two also
// carry a Private page's access_token: campaignAccessBody). The web API grants
// Public access while the code still points at that campaign (checked on every request: re-pointing the code takes the
// old campaign's access away at once) and answers qr_access: true. Likes, widget clicks and the photo upload need none.
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

/**
 * What opened a campaign page, for the API calls it gates on campaign access (POST /memories/{id}/track-view, POST
 * /memory-images/comments): qr (a printed QR code, any published state) and / or access_token (a Private campaign's
 * token, from the URL or typed into the prompt). null: nothing to send (a Public / view-only page: as before).
 */
export function campaignAccessBody(qr: string | null | undefined, accessToken: string | null | undefined): { qr?: string; access_token?: string } | null {
  const code = typeof qr === 'string' ? qr.trim() : '';
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  const body: { qr?: string; access_token?: string } = {};
  if (QR_CODE_PATTERN.test(code)) body.qr = code;
  if (token) body.access_token = token;
  return Object.keys(body).length ? body : null;
}
