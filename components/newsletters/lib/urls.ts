import { LIMITS } from './rules.ts';

/**
 * A valid https URL with a dotted host, normalised (quotes and spaces encoded), or null. The API's isHttpsUrl
 * refuses a ' anywhere and filter_var refuses _ in a host name, and one refused link fails the whole PUT, so ' is
 * encoded (URL keeps it as is) and such hosts give null.
 */
export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > LIMITS.url) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.hostname.includes('_')) return null;
    const href = u.href.replace(/'/g, '%27');
    return href.length > LIMITS.url ? null : href;
  } catch {
    return null;
  }
}

/** What people type ("serpachrysler.ca/offer") as an https URL. Other schemes (http:, ftp:, javascript:) give null. */
export function toHttpsUrl(input: string): string | null {
  const v = (input ?? '').trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return httpsUrl(v);
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) return null;
  return httpsUrl(`https://${v}`);
}

/** The 11-character video id from a YouTube watch / youtu.be / shorts / embed link. */
export function youtubeVideoId(value: string): string | null {
  const url = toHttpsUrl(value ?? '');
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^(www|m|music)\./, ''); // as NewsletterContent::youtubeId
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1] || null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
