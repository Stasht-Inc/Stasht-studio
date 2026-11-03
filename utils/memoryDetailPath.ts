// GET /memory-detail/{id}: a linked campaign opened from the public campaign page (PublishedMemoryPage).
// Since 3 Nov 2026 the web API reads a Private (published=3) parent campaign's linked campaigns only with that page's
// access token, so the page passes the token it was opened with (the URL's ?access_token= or the one typed into the
// token prompt) as ?access_token=. No token: the plain path, as before (public / view-only pages, signed-in owners and
// members).
// QR codes v2 (3 Nov 2026 evening): a page opened from a printed QR code also passes its ?qr= along (utils/qrAccess).
import { withQr } from './qrAccess.ts';

export function memoryDetailPath(memoryId: string | number, accessToken?: string | null, qr?: string | null): string {
  const token = typeof accessToken === 'string' ? accessToken.trim() : '';
  const path = `/memory-detail/${encodeURIComponent(String(memoryId))}`;
  return withQr(token ? `${path}?access_token=${encodeURIComponent(token)}` : path, qr);
}
