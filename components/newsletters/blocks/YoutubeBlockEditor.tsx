import { Youtube } from 'lucide-react';
import type { YoutubeBlockData } from '../../../services/newslettersAPI';
import { toHttpsUrl, youtubeThumbnail, youtubeVideoId } from '../lib/urls';
import { LABEL, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';
import { useUrlField } from './useUrlField';

const youtubeLink = (raw: string): string | null => (youtubeVideoId(raw) ? toHttpsUrl(raw) : null);

/** Email apps can't play video, so the email shows the thumbnail with a play button (blocks/youtube.blade.php). */
export default function YoutubeBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<YoutubeBlockData>) {
  const field = useUrlField(data.url ?? '', (next) => onChange({ url: next }), youtubeLink);
  const id = youtubeVideoId(data.url ?? '');
  return (
    <div>
      {id ? (
        <>
          <div className="relative h-[18.25rem] overflow-hidden rounded-lg bg-gray-900">
            <img src={youtubeThumbnail(id)} alt="YouTube video" className="h-full w-full object-cover" />
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-[#FF0000] pl-1 text-[1.75rem] leading-none text-white">&#9654;</span>
            </span>
          </div>
          <p className="mt-2 text-center text-sm"><span className="text-[#6C60FF] underline">Watch on YouTube</span></p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <Youtube className="h-6 w-6 text-[#FF4444]" aria-hidden="true" />
          <p className="text-sm text-gray-600">{readOnly ? 'No video' : 'Paste a YouTube link below.'}</p>
        </div>
      )}
      {selected && !readOnly ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label htmlFor={`${blockId}-youtube`} className={LABEL}>YouTube link</label>
          <input id={`${blockId}-youtube`} type="text" inputMode="url" value={field.draft} placeholder="https://www.youtube.com/watch?v=…"
            aria-invalid={field.invalid} aria-describedby={`${blockId}-youtube-help`}
            onChange={(e) => field.change(e.target.value)} onBlur={field.blur} className={inputClass(field.invalid)} />
          <p id={`${blockId}-youtube-help`} role={field.invalid ? 'alert' : undefined} className={`mt-1.5 text-xs ${field.invalid ? 'text-red-600' : 'text-gray-500'}`}>
            {field.invalid ? 'That doesn’t look like a YouTube link.' : 'Email apps can’t play video, so readers see this picture and tap it to watch on YouTube.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
