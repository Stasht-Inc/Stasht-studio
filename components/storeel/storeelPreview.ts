// [wdy2xh2t3z] What the Storeel tab's live preview shows for the form as it is now. Pure, so `node --test` loads it.
// Storeel flow v2 (4 Nov 2026): every moment the campaign will have (lib/previewMoments.ts), not just the first photo.
import type { PreviewMoment } from './lib/previewMoments.ts';

export interface StoreelPreviewInput {
  title: string;
  /** Every moment, in order (createPreviewMoments / savedPreviewMoments). */
  moments: PreviewMoment[];
  location: string;
  /** The form's date, YYYY-MM-DD. */
  date: string;
  authorName: string | null | undefined;
  /** The chosen cover photo (a local or uploaded link). */
  coverPhoto?: string | null;
  /** The chosen intro video (a local or uploaded link) — its first frame is the cover. */
  introVideo?: string | null;
  /** The brand: what the saved campaign page shows when there's no cover (storeelBrandImage). */
  brandImage?: string | null;
  /** The category's name (the cover's purple pill). */
  category?: string | null;
  /** The form's end date, YYYY-MM-DD (optional). */
  endDate?: string | null;
}

export type StoreelCoverKind = 'photo' | 'video' | 'brand';

export interface StoreelPreviewModel {
  title: string;
  /** The cover: the chosen cover photo, else the intro video, else the brand. Never the first photo. */
  cover: string | null;
  coverKind: StoreelCoverKind | null;
  /** The moment cards, with their place and date ready to show. */
  momentCards: PreviewMoment[];
  moments: string;
  author: string;
  initial: string;
  location: string;
  date: string;
  /** The cover's pills (Chris's Figma, 6 Nov 2026): the category and the campaign's year. */
  category: string;
  year: string;
  /** The cover's dates: the start, or "start – end". */
  dateRange: string;
}

export function momentsLabel(count: number): string {
  return `${count} ${count === 1 ? 'moment' : 'moments'}`;
}

export function initialsOf(name: string | null | undefined): string {
  const first = String(name ?? '').trim().charAt(0);
  return first ? first.toUpperCase() : 'U';
}

/** A calendar day (YYYY-MM-DD) in the person's language, or ''. */
function formatDay(date: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

const present = (v: string | null | undefined): string | null => (v && v.trim() ? v : null);

/**
 * The brand the saved campaign page falls back to when a campaign has no cover (MemoryDetailsPage): the property's
 * image in the property view, else the account's profile image (Chris, 4 Nov 2026).
 */
export function storeelBrandImage({ viewType, propertyImage, userAvatar }: {
  viewType: string | null | undefined;
  propertyImage?: string | null;
  userAvatar?: string | null;
}): string | null {
  return (viewType === 'property' ? present(propertyImage) : null) || present(userAvatar);
}

export function storeelPreviewModel(input: StoreelPreviewInput, locale?: string): StoreelPreviewModel {
  const campaignDate = formatDay(input.date ?? '', locale);
  const campaignLocation = input.location.trim();
  // A photo or product moment shows its own place and date, else the campaign's (as the API stores them).
  const momentCards = (input.moments ?? []).map((m) => (m.kind === 'photo' || m.kind === 'product'
    ? { ...m, location: m.location || campaignLocation, date: m.date ? formatDay(m.date, locale) : campaignDate }
    : m));
  const author = String(input.authorName ?? '').trim();
  const endDate = formatDay(input.endDate ?? '', locale);
  const photo = present(input.coverPhoto);
  const video = photo ? null : present(input.introVideo);
  const brand = photo || video ? null : present(input.brandImage);
  return {
    title: input.title.trim(),
    cover: photo || video || brand,
    coverKind: photo ? 'photo' : video ? 'video' : brand ? 'brand' : null,
    momentCards,
    moments: momentsLabel(momentCards.length),
    author: author || 'Username',
    initial: initialsOf(author),
    location: campaignLocation,
    date: campaignDate,
    category: String(input.category ?? '').trim(),
    year: /^(\d{4})-\d{2}-\d{2}$/.exec((input.date ?? '').trim())?.[1] ?? '',
    dateRange: campaignDate && endDate && endDate !== campaignDate ? `${campaignDate} – ${endDate}` : campaignDate,
  };
}
