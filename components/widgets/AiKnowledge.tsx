// components/widgets/AiKnowledge.tsx
// "Files" and "Your website" (spec 2026-10-02-widget-ai-knowledge-design.md §5), rendered inside
// AfterHoursSettings right under "Notes for the AI" — the three feed the widget AI together.
// Unlike the rest of the builder, changes here save immediately (one file/import/delete at a
// time), not as part of the form's "Save changes".
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { AlertTriangle, Copy, FileText, Loader2, RotateCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { widgetsAPI, KNOWLEDGE_CHAR_LIMIT, KNOWLEDGE_MAX_FILES } from '../../services/widgetsAPI';
import type { KnowledgeSource } from '../../services/widgetsAPI';
import { copyText } from './widgetHelpers';

const ACCEPT = '.pdf,.docx,.txt,.csv,.md';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const READER_IP = '18.190.41.14';
const READER_UA = 'StashtBot/1.0 (+https://stasht.com)';
const BLOCKED_COPY =
  "Your website blocked our reader. Ask whoever manages your website (or Cloudflare) to allow Stasht's reader — " +
  `server IP ${READER_IP}, user agent ${READER_UA} — then click Try again.`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function formatChars(n: number): string {
  return n.toLocaleString('en-US');
}

function FileRow({ source, busy, onRemove }: { source: KnowledgeSource; busy: boolean; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
      <FileText className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800 truncate" title={source.name}>{source.name}</p>
        {source.status === 'ready' ? (
          <p className="text-xs text-green-700">Ready · {formatChars(source.chars)} characters</p>
        ) : (
          <p className="text-xs text-red-600">Couldn't read{source.error ? ` — ${source.error}` : ''}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remove ${source.name}`}
        title="Remove"
        className="text-gray-400 hover:text-gray-700 disabled:opacity-50 shrink-0"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function AiKnowledge({ publicId, idPrefix, firstDomain, onHasContentChange }: {
  publicId: string | null;
  idPrefix: string;
  firstDomain?: string;
  onHasContentChange?: (hasContent: boolean) => void;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [usedChars, setUsedChars] = useState(0);
  const [limitChars, setLimitChars] = useState(KNOWLEDGE_CHAR_LIMIT);

  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteBusy, setWebsiteBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset (not just declare) on mount: React 18 StrictMode dev double-invokes effects —
  // mount, cleanup, mount again — on the SAME ref, so only setting true in the cleanup would
  // leave this permanently true after that simulated cycle, even though the component is live.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  // Re-runs when publicId goes from null (unsaved) to a real id — WidgetBuilder updates its
  // `saved` widget in place on first save rather than remounting, so this can't be a mount-once effect.
  useEffect(() => {
    if (!publicId) { setSources(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await widgetsAPI.getKnowledge(publicId);
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) {
        setSources(res.data.sources);
        setUsedChars(res.data.used_chars);
        setLimitChars(res.data.limit_chars);
      } else {
        toast.error(res.error || 'Could not load files and your website.');
        setSources([]);
      }
    })();
    return () => { cancelled = true; };
  }, [publicId]);

  const fileSources = useMemo(() => (sources || []).filter((s) => s.kind === 'file'), [sources]);
  const websiteSource = useMemo(() => (sources || []).find((s) => s.kind === 'website') || null, [sources]);

  // Prefill the URL field from the saved website source, or (once, if the owner hasn't typed
  // anything yet) from the widget's first allowed domain.
  useEffect(() => {
    if (sources === null) return;
    if (websiteSource) { setWebsiteUrl(websiteSource.name); return; }
    setWebsiteUrl((prev) => (prev || (firstDomain ? `https://${firstDomain}` : '')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, websiteSource]);

  const onHasContentRef = useRef(onHasContentChange);
  useEffect(() => { onHasContentRef.current = onHasContentChange; });
  useEffect(() => {
    onHasContentRef.current?.((sources || []).some((s) => s.status === 'ready'));
  }, [sources]);

  function upsertWebsiteSource(source: KnowledgeSource) {
    setSources((prev) => {
      const list = prev || [];
      const idx = list.findIndex((s) => s.kind === 'website');
      if (idx === -1) return [...list, source];
      const copy = [...list];
      copy[idx] = source;
      return copy;
    });
  }

  const onFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !publicId) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Files can be 10 MB at most.');
      return;
    }
    setUploading(true);
    const res = await widgetsAPI.uploadKnowledgeFile(publicId, file);
    if (unmountedRef.current) return;
    setUploading(false);
    if (!res.ok || !res.data) {
      toast.error(res.fieldErrors.file || res.error || 'Could not upload that file.');
      return;
    }
    setSources((prev) => [...(prev || []), res.data!.source]);
    setUsedChars(res.data.used_chars);
    setLimitChars(res.data.limit_chars);
  };

  const removeSource = async (source: KnowledgeSource) => {
    if (!publicId) return;
    const prompt = source.kind === 'website'
      ? "Remove your website from the AI's knowledge? This can't be undone."
      : `Remove "${source.name}"? This can't be undone.`;
    if (!window.confirm(prompt)) return;
    setRemovingId(source.id);
    const res = await widgetsAPI.removeKnowledgeSource(publicId, source.id);
    if (unmountedRef.current) return;
    setRemovingId(null);
    if (!res.ok) {
      toast.error(res.error || 'Could not remove that.');
      return;
    }
    setSources((prev) => (prev || []).filter((s) => s.id !== source.id));
    if (res.data) {
      setUsedChars(res.data.used_chars);
      setLimitChars(res.data.limit_chars);
    }
  };

  const startImport = async () => {
    if (!publicId || websiteBusy) return;
    const url = websiteUrl.trim();
    if (!url) {
      toast.error("Enter your website's address, like https://example.com.");
      return;
    }
    setWebsiteBusy(true);
    setProgress(null);
    const res = await widgetsAPI.startWebsiteImport(publicId, url);
    if (unmountedRef.current) return;
    if (!res.ok || !res.data) {
      setWebsiteBusy(false);
      toast.error(res.fieldErrors.url || res.error || 'Could not import that website.');
      return;
    }
    const data = res.data;
    upsertWebsiteSource(data.source);
    if (data.status !== 'importing') {
      // Blocked or failed homepage: the alert below the website row (driven by `data.source`)
      // already explains it; nothing left to do here.
      setWebsiteBusy(false);
      return;
    }

    const pages = data.pages;
    const importId = data.import_id;
    setProgress({ done: 0, total: pages.length });
    for (let i = 0; i < pages.length; i++) {
      if (unmountedRef.current) return; // builder closed mid-import: just stop, the server expires it
      const pr = await widgetsAPI.importWebsitePage(publicId, importId, pages[i]);
      if (unmountedRef.current) return;
      if (!pr.ok) {
        // The import itself died server-side (not just one blocked/failed page, which doesn't
        // stop the loop) — e.g. it expired. Surface it and give up on this run.
        setWebsiteBusy(false);
        setProgress(null);
        toast.error(pr.error || 'Could not finish importing your website.');
        return;
      }
      setProgress({ done: i + 1, total: pages.length });
    }

    const fin = await widgetsAPI.finishWebsiteImport(publicId, importId);
    if (unmountedRef.current) return;
    setWebsiteBusy(false);
    setProgress(null);
    if (!fin.ok || !fin.data) {
      toast.error(fin.error || 'Could not finish importing your website.');
      return;
    }
    upsertWebsiteSource(fin.data.source);
    setUsedChars(fin.data.used_chars);
    setLimitChars(fin.data.limit_chars);
  };

  const copyReaderInfo = async () => {
    const ok = await copyText(`${READER_IP}, ${READER_UA}`);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy. Select the text instead.');
    }
  };

  if (!publicId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-3 text-xs text-gray-400">
        Save the widget to add files and import your website.
      </div>
    );
  }

  const atFileLimit = fileSources.length >= KNOWLEDGE_MAX_FILES;
  const overLimit = usedChars > limitChars;
  const importBusy = websiteBusy; // start -> page loop -> finish, start to finish

  return (
    <div className="space-y-4">
      {/* Files */}
      <div>
        <p className="text-sm font-medium text-gray-800 mb-1.5">Files</p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : fileSources.length > 0 ? (
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            {fileSources.map((f) => (
              <FileRow key={f.id} source={f} busy={removingId === f.id} onRemove={() => removeSource(f)} />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || atFileLimit}
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-not-allowed"
            style={{ color: '#5A4FE5' }}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Reading…' : 'Upload file'}
          </button>
          <span id={id('files-help')} className={'text-xs ' + (atFileLimit ? 'text-amber-700' : 'text-gray-400')}>
            {atFileLimit ? 'You can add up to 5 files.' : 'Up to 5 files, 10 MB each.'}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={onFilePicked}
          aria-describedby={id('files-help')}
        />
      </div>

      {/* Website */}
      <div>
        <label htmlFor={id('website-url')} className="block text-sm font-medium text-gray-800 mb-1.5">Your website</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={id('website-url')}
            type="text"
            inputMode="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            disabled={importBusy}
            placeholder="https://example.com"
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/40 focus:border-[#6C60FF] disabled:opacity-60 min-w-0"
          />
          <button
            type="button"
            onClick={startImport}
            disabled={importBusy || !websiteUrl.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#6C60FF' }}
          >
            {importBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {websiteSource ? 'Re-import' : 'Import'}
          </button>
        </div>

        {progress && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: '#6C60FF' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Reading pages… {progress.done} of {progress.total}</p>
          </div>
        )}

        {!progress && websiteSource?.status === 'ready' && (
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-xs text-green-700 min-w-0 truncate">
              Ready{websiteSource.pages != null ? ` · ${websiteSource.pages} page${websiteSource.pages === 1 ? '' : 's'}` : ''}
              {' · '}{formatChars(websiteSource.chars)} characters
              {websiteSource.imported_at ? ` · imported ${shortDate(websiteSource.imported_at)}` : ''}
            </p>
            <button
              type="button"
              onClick={() => removeSource(websiteSource)}
              disabled={removingId === websiteSource.id}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 shrink-0"
            >
              {removingId === websiteSource.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        )}

        {!progress && websiteSource?.status === 'blocked' && (
          <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-700">{BLOCKED_COPY}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button
                type="button"
                onClick={startImport}
                disabled={importBusy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-60"
                style={{ color: '#5A4FE5' }}
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                onClick={copyReaderInfo}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                <Copy className="w-3 h-3" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy IP + user agent'}
              </button>
            </div>
          </div>
        )}

        {!progress && websiteSource?.status === 'failed' && (
          <div className="mt-1.5">
            <p className="text-xs text-red-600">{websiteSource.error || "Couldn't read your website."}</p>
            <button
              type="button"
              onClick={startImport}
              disabled={importBusy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline disabled:opacity-60 mt-1"
              style={{ color: '#5A4FE5' }}
            >
              <RotateCw className="w-3 h-3" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {!websiteSource && !progress && (
          <p className="text-xs text-gray-400 mt-1">We'll read up to 20 pages of your site and keep the text up to date here.</p>
        )}
      </div>

      {/* Usage */}
      {!loading && sources !== null && (usedChars > 0 || (sources || []).length > 0) && (
        <p className={'text-xs ' + (overLimit ? 'text-amber-700' : 'text-gray-400')}>
          {overLimit
            ? 'Over the limit — the AI uses the first 60,000 characters. Notes are always included in full.'
            : `Using ${formatChars(usedChars)} of ${formatChars(limitChars)} characters.`}
        </p>
      )}
    </div>
  );
}
