import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, Camera, Loader2, Type, Upload, Video, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { VideoRecorderModal } from '../VideoRecorderModal';
import { getApiBaseUrl } from '../../utils/authUtils';
import { ensureInMemory, readVideoDuration, UploadFileError, VIDEO_READ_FAILED } from '../../utils/uploadFiles';
import { canRecordVideo, MOMENT_VIDEO_ACCEPT, MOMENT_VIDEO_MAX_SECONDS, momentVideoNote, uploadMomentVideo, type UploadedMomentVideo } from '../../utils/momentVideo';

/** A video moment as this editor hands it back (the moment's video, its title and caption). */
export interface VideoMomentValue {
  fileUrl: string;
  sizeMB: number;
  /** The picked / recorded file's name (the moment's name). */
  name: string;
  title: string;
  description: string;
}

/**
 * "+" → Video (Deepak, 24 Nov 2026, P5): a video becomes a moment where the "+" was. Upload video / Record video, as
 * Create's Intro Video field offers them (same picker `accept`, the same in-memory copy of a Mac Photos pick, upload
 * progress, the same VideoRecorderModal — here with a 30-second countdown). Any length may be uploaded; over 30 s the
 * note "Only the first 30 seconds will be used." shows under it (the web API keeps the first 30 s). Then the moment's
 * title (optional) and description, as Add a Moment asks them.
 *
 * The video is uploaded as soon as it is picked (memories/upload-video purpose=moment); Add hands the result to the
 * caller: Create Storeel keeps it in the preview until Save as Draft / Send, the campaign page saves it at once.
 * `editing`: an unsaved video moment on Create (its video can be replaced; Save Changes).
 * The widget editors' dialog shell (WidgetEditorDialogs: full screen on phones, a card on computers).
 */
export default function VideoMomentDialog({ open, onOpenChange, onSave, editing = null, memoryId = null, saving = false }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Add / Save Changes. Return false (or throw) to keep the editor open (the caller shows its own message). */
  onSave(value: VideoMomentValue): boolean | void | Promise<boolean | void>;
  editing?: VideoMomentValue | null;
  /** The campaign it goes to, when it exists (the upload's folder). */
  memoryId?: number | string | null;
  /** The caller is saving (the campaign page's moment create). */
  saving?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const seqRef = useRef(0);
  const [recordable, setRecordable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [name, setName] = useState('');
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedMomentVideo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [showTitle, setShowTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Each open starts from the moment being edited, or empty.
  useEffect(() => {
    if (!open) return;
    seqRef.current += 1;
    abortRef.current?.();
    abortRef.current = null;
    setRecording(false);
    setName(editing?.name ?? '');
    setLocalUrl(null);
    setUploaded(editing ? { fileUrl: editing.fileUrl, sizeMB: editing.sizeMB } : null);
    setProgress(null);
    setDuration(null);
    setShowTitle(Boolean(editing?.title));
    setTitle(editing?.title ?? '');
    setDescription(editing?.description ?? '');
    setError(null);
    setSubmitting(false);
    let live = true;
    void canRecordVideo(typeof navigator !== 'undefined' ? navigator : undefined, typeof window !== 'undefined' ? window.innerWidth : undefined)
      .then((can) => { if (live) setRecordable(can); });
    return () => { live = false; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { abortRef.current?.(); }, []);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  const clearVideo = () => {
    seqRef.current += 1;
    abortRef.current?.();
    abortRef.current = null;
    setName('');
    setLocalUrl(null);
    setUploaded(null);
    setProgress(null);
    setDuration(null);
    setError(null);
  };

  /** A picked or recorded video: shown at once, its length read (for the note), uploaded. */
  const takeVideo = async (picked: File) => {
    let file: File;
    try {
      // A Mac Photos pick is written by macOS at pick time; read it now (as Intro Video does, Chris 20 Nov 2026).
      file = await ensureInMemory(picked);
    } catch (e) {
      setError(e instanceof UploadFileError ? e.message : VIDEO_READ_FAILED);
      return;
    }
    clearVideo();
    const seq = seqRef.current;
    setName(file.name);
    setLocalUrl(URL.createObjectURL(file));
    setProgress(0);
    void readVideoDuration(file).then((d) => { if (seq === seqRef.current) setDuration(d); });
    const job = uploadMomentVideo(file, {
      apiBase: getApiBaseUrl(),
      token: typeof localStorage !== 'undefined' ? localStorage.getItem('stasht_token') : null,
      memoryId,
      onProgress: (p) => { if (seq === seqRef.current) setProgress(p); },
    });
    abortRef.current = job.abort;
    try {
      const video = await job.promise;
      if (seq !== seqRef.current) return;
      setUploaded(video);
      setProgress(null);
    } catch (e) {
      if (seq !== seqRef.current || (e as Error)?.message === 'aborted') return;
      console.error('Moment video upload failed:', e);
      setProgress(null);
      setError((e as Error)?.message || "The video couldn't be uploaded. Please try again.");
    } finally {
      if (seq === seqRef.current) abortRef.current = null;
    }
  };

  const uploading = progress !== null;
  const note = momentVideoNote(duration);
  const busy = submitting || saving;
  const heading = editing ? 'Edit Video' : 'Add Video';

  const submit = async () => {
    if (!uploaded || uploading || busy) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onSave({
        fileUrl: uploaded.fileUrl,
        sizeMB: uploaded.sizeMB,
        name: name || editing?.name || 'Video',
        title: showTitle ? title.trim() : '',
        description: description.trim(),
      });
      if (ok === false) return;
    } catch (e) {
      setError((e as Error)?.message || "The video couldn't be added. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const close = (next: boolean) => {
    if (next) return;
    abortRef.current?.();
    abortRef.current = null;
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !recording} onOpenChange={close}>
        <DialogContent data-testid="video-moment-dialog" className="max-w-none md:max-w-[480px] w-full h-full md:h-auto md:max-h-[90vh] bg-white p-0 md:p-6 border-0 shadow-xl md:rounded-lg rounded-none top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%] flex flex-col [&>button[data-slot=dialog-default-close]]:hidden md:[&>button[data-slot=dialog-default-close]]:flex">
          {/* Mobile Header with title + close */}
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h4 className="font-semibold text-[18px] md:text-lg text-gray-900">{heading}</h4>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 hover:bg-gray-100 rounded-full" aria-label="Close">
                <X className="!w-[28px] !h-[28px] text-black" />
              </Button>
            </DialogClose>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 md:px-0 md:pt-0 md:pb-0">
            <div className="space-y-5 md:space-y-4">
              <DialogHeader className="space-y-1 pb-2 text-left hidden md:block">
                <DialogTitle className="text-xl md:text-lg font-semibold text-gray-900">{heading}</DialogTitle>
                <p className="text-sm text-gray-500">Upload or record a video for your timeline</p>
              </DialogHeader>

              <input
                ref={inputRef}
                type="file"
                accept={MOMENT_VIDEO_ACCEPT}
                className="hidden"
                data-testid="video-moment-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = '';
                  if (file) void takeVideo(file);
                }}
              />

              <div>
                <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
                  <Video className="w-4 h-4 text-black flex-shrink-0" />
                  Video
                </label>
                {name || uploaded ? (
                  <div className="space-y-2">
                    <div className="flex h-12 md:h-10 items-center justify-between gap-2 px-3 border border-gray-200 rounded-lg bg-gray-50" data-testid="video-moment-chosen">
                      <div className="flex items-center gap-2 min-w-0">
                        {uploading
                          ? <Loader2 className="w-4 h-4 text-[#6C60FF] flex-shrink-0" style={{ animation: 'spin 2s linear infinite' }} />
                          : <Video className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-gray-700 truncate">{name || 'Video'}</span>
                          {uploading && <span className="text-xs text-[#6C60FF]" data-testid="video-moment-progress">Uploading... {progress}%</span>}
                        </div>
                      </div>
                      <button type="button" aria-label="Remove video" onClick={clearVideo} className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {(localUrl || uploaded?.fileUrl) && (
                      <video
                        key={localUrl || uploaded?.fileUrl}
                        src={localUrl || `${uploaded?.fileUrl}#t=0.1`}
                        controls
                        playsInline
                        preload="metadata"
                        data-testid="video-moment-preview"
                        className="w-full max-h-[240px] rounded-lg bg-black object-contain"
                      />
                    )}
                    {note && <p className="text-xs text-gray-500" data-testid="video-moment-note">{note}</p>}
                  </div>
                ) : (
                  <div className={`grid gap-2 ${recordable ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex h-12 md:h-10 items-center justify-center gap-2 px-2 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-[#6C60FF]" /> Upload video
                    </button>
                    {recordable && (
                      <button
                        type="button"
                        onClick={() => { setError(null); setRecording(true); }}
                        className="flex h-12 md:h-10 items-center justify-center gap-2 px-2 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Camera className="w-4 h-4 text-[#6C60FF]" /> Record video
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Title and description, as Add a Moment asks them. */}
              <div>
                <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTitle}
                    onChange={(e) => setShowTitle(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-[#7B68EE] focus:ring-[#7B68EE] focus:ring-offset-0 cursor-pointer"
                  />
                  <Type className="w-4 h-4" />
                  <span>Add a title</span>
                  <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                {showTitle && (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Add a short title"
                    className="w-full p-3 text-[14px] md:text-sm rounded-lg bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20 focus:border-[#7B68EE]/30 placeholder:text-gray-400"
                  />
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
                  <AlignLeft className="w-4 h-4" />
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this moment in detail..."
                  className="w-full p-3 text-[14px] md:text-sm rounded-lg resize-none h-28 bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20 focus:border-[#7B68EE]/30 placeholder:text-gray-400"
                />
              </div>
              {error && <p className="text-sm text-red-600" role="alert" data-testid="video-moment-error">{error}</p>}
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-3 px-5 py-3 pb-[50px] md:px-0 md:py-0 md:pb-0 md:pt-4 border-t md:border-t-0 border-gray-100">
            <Button variant="outline" onClick={() => close(false)} className="h-12 md:h-10 px-6 text-[14px] md:text-sm border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </Button>
            <Button
              disabled={!uploaded || uploading || busy}
              onClick={() => { void submit(); }}
              data-testid="video-moment-save"
              className="h-12 md:h-10 px-6 text-[14px] md:text-sm bg-[#6C60FF] hover:bg-[#5A52E6] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving...' : editing ? 'Save Changes' : 'Add Video'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {recording && createPortal(
        <VideoRecorderModal
          isOpen
          maxSeconds={MOMENT_VIDEO_MAX_SECONDS}
          filePrefix="storeel_video"
          onClose={() => setRecording(false)}
          onRecorded={(file) => { setRecording(false); void takeVideo(file); }}
        />,
        document.body,
      )}
    </>
  );
}
