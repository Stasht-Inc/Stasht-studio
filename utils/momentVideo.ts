// Storeel moment videos (Deepak, 24 Nov 2026, P5): "+" → Video uploads or records a video that becomes a moment. Only
// its first 30 seconds are kept — the web API cuts it (memories/upload-video purpose=moment, ffmpeg); a longer upload is
// never refused, it only gets a note. The recorder stops by itself at 30 s. Intro Video is separate and unchanged
// (2-minute upload limit, MAX_COVER_VIDEO_SECONDS; its recorder 60 s).

/** A moment video keeps this many seconds (the web API's MomentVideoTrim::MAX_SECONDS). */
export const MOMENT_VIDEO_MAX_SECONDS = 30;

/** The note under a picked video longer than 30 s (null: fine, or its length unknown). */
export function momentVideoNote(durationSeconds: number | null | undefined, maxSeconds = MOMENT_VIDEO_MAX_SECONDS): string | null {
  if (durationSeconds == null || !Number.isFinite(durationSeconds) || !(durationSeconds > maxSeconds + 0.05)) return null;
  return `Only the first ${maxSeconds} seconds will be used.`;
}

/** The `accept` of the video picker (Create's Intro Video field's). */
export const MOMENT_VIDEO_ACCEPT = 'video/*,video/quicktime,.mov,.mp4,.m4v';

type DeviceLike = {
  userAgent?: string;
  mediaDevices?: { enumerateDevices?: () => Promise<Array<{ kind: string }>> };
};

/** A phone / tablet (records with its camera, as Intro Video does there). */
export function isPhoneDevice(nav: DeviceLike | undefined, width?: number): boolean {
  return /iPhone|iPad|iPod|Android/i.test(nav?.userAgent ?? '') || (typeof width === 'number' && width < 768);
}

/**
 * Record video is offered on phones and on computers with a camera. A computer without one (or a browser that can't
 * list devices) gets Upload only. Never throws.
 */
export async function canRecordVideo(nav: DeviceLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined, width?: number): Promise<boolean> {
  if (!nav) return false;
  if (isPhoneDevice(nav, width)) return true;
  try {
    const devices = await nav.mediaDevices?.enumerateDevices?.();
    return Array.isArray(devices) && devices.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

/** What an upload gives back: the stored video's URL and size (MB). */
export interface UploadedMomentVideo { fileUrl: string; sizeMB: number }

/** The upload-video reply → the stored video (null: no URL in it). Pure, for tests. */
export function uploadedMomentVideoFrom(data: any): UploadedMomentVideo | null {
  const fileUrl = typeof data?.fileUrl === 'string' && data.fileUrl ? data.fileUrl : null;
  if (!fileUrl) return null;
  const size = Number(data?.compressedSizeMB ?? data?.originalSizeMB ?? 0);
  return { fileUrl, sizeMB: Number.isFinite(size) ? size : 0 };
}

export const MOMENT_VIDEO_UPLOAD_FAILED = "The video couldn't be uploaded. Please try again.";

/**
 * Upload a moment video: POST memories/upload-video with purpose=moment (the web API keeps its first 30 s). Real
 * upload progress (0–99 while sending, 100 when stored). `abort()` stops it (rejects with 'aborted').
 */
export function uploadMomentVideo(file: File, opts: { apiBase: string; token?: string | null; memoryId?: number | string | null; onProgress?(percent: number): void }): { promise: Promise<UploadedMomentVideo>; abort(): void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadedMomentVideo>((resolve, reject) => {
    const form = new FormData();
    form.append('video', file, file.name);
    form.append('purpose', 'moment');
    if (opts.memoryId != null && opts.memoryId !== '') form.append('memory_id', String(opts.memoryId));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) opts.onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      const video = xhr.status >= 200 && xhr.status < 300 ? uploadedMomentVideoFrom(data) : null;
      if (video) { opts.onProgress?.(100); resolve(video); return; }
      const message = typeof data?.message === 'string' && data.message && xhr.status === 422 ? data.message : MOMENT_VIDEO_UPLOAD_FAILED;
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error(MOMENT_VIDEO_UPLOAD_FAILED));
    xhr.onabort = () => reject(new Error('aborted'));
    xhr.open('POST', `${opts.apiBase}/memories/upload-video`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (opts.token) xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
