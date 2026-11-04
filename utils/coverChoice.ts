// Create New Campaign's "Cover photo | Add Intro Video" row (Chris, 4 Nov 2026). Pure, so `node --test` loads it.
//
// Both are saved in the same field (memories.last_update_img), so a campaign has ONE OR THE OTHER: choosing a cover
// photo replaces the intro video and the other way round. Each pick carries a number (`seq`); an upload that finishes
// (or fails) after a newer pick, or after the choice was removed, is ignored.

export type CoverKind = 'photo' | 'video';

export interface CoverChoice<F = unknown> {
  kind: CoverKind | null;
  /** The picked file — for a local preview while it uploads. */
  file: F | null;
  name: string;
  /** The uploaded link, sent as last_update_img. */
  url: string | null;
  uploading: boolean;
  progress: number;
  /** The pick this state belongs to. */
  seq: number;
}

export type CoverChoiceAction<F = unknown> =
  | { type: 'pick'; seq: number; kind: CoverKind; file: F | null; name: string }
  | { type: 'ready'; seq: number; kind: CoverKind; file: F | null; name: string; url: string }
  | { type: 'progress'; seq: number; progress: number }
  | { type: 'uploaded'; seq: number; url: string }
  | { type: 'failed'; seq: number }
  | { type: 'clear' };

export const EMPTY_COVER_CHOICE: CoverChoice<never> = Object.freeze({
  kind: null, file: null, name: '', url: null, uploading: false, progress: 0, seq: 0,
}) as CoverChoice<never>;

export function coverChoiceReducer<F>(state: CoverChoice<F>, action: CoverChoiceAction<F>): CoverChoice<F> {
  switch (action.type) {
    case 'pick':
      return { kind: action.kind, file: action.file, name: action.name, url: null, uploading: true, progress: 0, seq: action.seq };
    case 'ready':
      return { kind: action.kind, file: action.file, name: action.name, url: action.url, uploading: false, progress: 0, seq: action.seq };
    case 'progress':
      return action.seq === state.seq && state.uploading ? { ...state, progress: action.progress } : state;
    case 'uploaded':
      return action.seq === state.seq && state.uploading ? { ...state, url: action.url, uploading: false, progress: 0 } : state;
    case 'failed':
      return action.seq === state.seq && state.uploading ? { ...EMPTY_COVER_CHOICE, seq: state.seq } : state;
    case 'clear':
      // Bump seq so an upload still running for the removed pick can't bring it back.
      return { ...EMPTY_COVER_CHOICE, seq: state.seq + 1 };
    default:
      return state;
  }
}

/** What the create request gets: the uploaded cover photo or intro video as last_update_img, once it is uploaded. */
export function coverChoicePayload(state: CoverChoice<unknown>): { last_update_img?: string } {
  return state.kind && state.url && !state.uploading ? { last_update_img: state.url } : {};
}

// Same types and size as the form's Media picker ("JPG, JPEG, PNG up to 10MB").
export const COVER_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const COVER_PHOTO_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';
const COVER_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export function coverPhotoFileError(file: { type?: string; size?: number }): string | null {
  if (!COVER_PHOTO_TYPES.includes(String(file.type ?? '').toLowerCase())) return 'Please choose a JPG, JPEG or PNG photo.';
  if ((file.size ?? 0) > COVER_PHOTO_MAX_BYTES) return 'The cover photo must be 10MB or smaller.';
  return null;
}
