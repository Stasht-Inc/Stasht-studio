import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Circle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';
import { catalogueAPI, type CatalogueDomain, type CatalogueResult, type CatalogueScan } from '../../services/catalogueAPI';
import {
  BlockedHelp,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CatalogueModalShell,
  Notice,
  PreviewImage,
  VerificationMethods,
} from './WebsiteCatalogueParts';
import { PROGRESS_STEPS, foundSummary, plural, progressIndex } from './websiteCatalogue';

type Step = 'url' | 'verify' | 'progress' | 'outcome';

const HOW_IT_WORKS = [
  "Enter your website's address",
  'Prove you own it with a meta tag, a DNS record or your Contact Us widget',
  'We analyse your website and show you a preview',
  'Connect: we import up to 500 items and keep them in sync every night',
];

const POLL_MS = 3000;
const PREVIEW_COUNT = 5;
const MAX_POLL_FAILURES = 5;

function initialStep(scan: CatalogueScan | null): Step {
  if (!scan || scan.status === 'expired') return 'url';
  return scan.in_progress ? 'progress' : 'outcome';
}

interface Props {
  /** The account's latest unexpired scan (GET /website-catalogue): reopens the dialog where the user left it. */
  initialScan: CatalogueScan | null;
  onClose: () => void;
  /** A website was connected: the page reloads the card. */
  onConnected: () => void;
  /** A scan started, was re-queued or finished: the page refreshes the card ("Analysing…"). */
  onScanChanged: () => void;
}

/** Spec 2026-09-30 §8.2: URL → verify ownership → progress → outcome. */
export function WebsiteCatalogueConnectModal({ initialScan, onClose, onConnected, onScanChanged }: Props) {
  const [step, setStep] = useState<Step>(() => initialStep(initialScan));
  const [url, setUrl] = useState(initialScan?.url ?? '');
  const [authorized, setAuthorized] = useState(false);
  const [domain, setDomain] = useState<CatalogueDomain | null>(initialScan?.domain ?? null);
  const [scan, setScan] = useState<CatalogueScan | null>(initialScan && initialScan.status !== 'expired' ? initialScan : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pollTrouble, setPollTrouble] = useState(false);
  const [pollStopped, setPollStopped] = useState(false);

  // Callbacks and liveness live in refs so the polling effect never restarts for them and never acts after unmount.
  const mounted = useRef(true);
  const onScanChangedRef = useRef(onScanChanged);
  onScanChangedRef.current = onScanChanged;
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Step 3: ask for the scan every 3 s while the engine works. One request at a time (the next is scheduled only
  // after the answer), and it stops on a terminal status, on unmount (closing the dialog) and when the step changes.
  const scanId = scan?.id;
  useEffect(() => {
    if (step !== 'progress' || scanId === undefined) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;
    setPollStopped(false);

    const tick = async () => {
      const res = await catalogueAPI.getScan(scanId);
      if (cancelled) return;
      if (res.ok && res.data) {
        failures = 0;
        setPollTrouble(false);
        const next = res.data.scan;
        setScan(next);
        if (next.domain) setDomain(next.domain);
        if (!next.in_progress) {
          setStep('outcome');
          onScanChangedRef.current();
          return; // terminal: no further polling
        }
      } else if (res.code === 'not_found') {
        setError(res.error || "We couldn't find that check any more. Please start again.");
        setScan(null);
        setStep('url');
        onScanChangedRef.current(); // the card behind must stop saying "Analysing…"
        return;
      } else if (res.code === 'plan_required' || res.code === 'not_available') {
        // Permanent: the account can no longer use the catalogue. Stop (each further call would reopen the upgrade modal).
        setError(res.error || 'Website Catalogue is not available on your account.');
        setPollStopped(true);
        return;
      } else {
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) setPollTrouble(true);
      }
      timer = window.setTimeout(tick, POLL_MS);
    };

    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [step, scanId]);

  /**
   * Run a write. The result is always returned, even if the dialog was closed meanwhile, because the server has acted
   * and the page behind must hear about it (callers notify the parent through the refs). Callers must not set state
   * once `mounted.current` is false.
   */
  const act = async <T,>(request: Promise<CatalogueResult<T>>): Promise<CatalogueResult<T>> => {
    setBusy(true);
    setError('');
    const res = await request;
    if (mounted.current) setBusy(false);
    return res;
  };

  const begin = async (scanUrl: string) => {
    const res = await act(catalogueAPI.startScan(scanUrl));
    if (!res.ok || !res.data) {
      if (res.code === 'already_connected') onScanChangedRef.current(); // a website is already connected: refresh the card behind us
      if (mounted.current) setError(res.error || "We couldn't start the check. Please try again.");
      return;
    }
    onScanChangedRef.current();
    if (!mounted.current) return;
    setScan(res.data.scan);
    if (res.data.scan.domain) setDomain(res.data.scan.domain);
    setStep(res.data.scan.in_progress ? 'progress' : 'outcome');
  };

  const submitUrl = async () => {
    if (!url.trim()) {
      setError("Enter your website's address, for example www.yourstore.com.");
      return;
    }
    if (!authorized) {
      setError('Tick the box to confirm you own this website or are authorised to import its catalogue.');
      return;
    }
    const res = await act(catalogueAPI.registerDomain(url.trim()));
    if (res.code === 'already_connected') onScanChangedRef.current();
    if (!mounted.current) return; // closed meanwhile: registering is harmless, but don't start a scan nobody asked for now
    if (!res.ok || !res.data) {
      setError(res.error || 'Something went wrong. Please try again.');
      return;
    }
    setUrl(res.data.url);
    setDomain(res.data.domain);
    if (res.data.domain.status === 'verified') {
      await begin(res.data.url); // already proven: straight to the analysis (spec §8.2 step 1)
    } else {
      setStep('verify');
    }
  };

  const checkAgain = async () => {
    if (!scan) return;
    const res = await act(catalogueAPI.checkAgain(scan.id));
    if (!res.ok || !res.data) {
      if (mounted.current) setError(res.error || "We couldn't check again. Please try again.");
      return;
    }
    onScanChangedRef.current();
    if (!mounted.current) return;
    setScan(res.data.scan);
    setStep(res.data.scan.in_progress ? 'progress' : 'outcome');
  };

  const connect = async () => {
    if (!scan) return;
    const res = await act(catalogueAPI.connect(scan.id));
    if (!res.ok) {
      if (res.code === 'already_connected') onScanChangedRef.current(); // refresh the card behind us
      if (!mounted.current) return;
      setError(res.error || "We couldn't connect your website. Please try again.");
      if (res.code === 'scan_expired' || res.code === 'not_found') {
        setScan(null);
        setStep('url'); // the preview is too old: analyse again
      } else if (res.code === 'not_verified' && domain) {
        setScan(null);
        setStep('verify');
      }
      return;
    }
    toast.success("Website connected. We're importing your items now.");
    onConnectedRef.current();
  };

  const startOver = (nextUrl?: string) => {
    setScan(null);
    setDomain(null);
    setAuthorized(false);
    setError('');
    setUrl(nextUrl ?? scan?.url ?? url);
    setStep('url');
  };

  const host = domain?.host ?? scan?.host ?? '';
  const outcome = scan?.outcome ?? null;
  let body: ReactNode = null;
  let footer: ReactNode = null;
  const close = (
    <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
      Close
    </button>
  );
  const spinner = busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null;

  if (step === 'url') {
    body = (
      <>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-blue-700 font-semibold text-sm">How it works</span>
          </div>
          <ul className="space-y-1.5">
            {HOW_IT_WORKS.map((line, i) => (
              <li key={line} className="text-blue-600 text-sm leading-snug">{i + 1}. {line}</li>
            ))}
          </ul>
        </div>
        <div>
          <label htmlFor="website-catalogue-url" className="block text-sm font-medium text-gray-800 mb-1.5">
            Website address<span className="text-red-500">*</span>
          </label>
          <input
            id="website-catalogue-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setAuthorized(false); // the tick covers one website: a changed address needs it again
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submitUrl(); }}
            placeholder="www.yourstore.com"
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
          />
          <p className="text-xs text-gray-500 mt-1">One website per account. We only read pages your website lets robots read.</p>
        </div>
        <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#6C60FF]"
          />
          <span>I own this website or am authorised to import its catalogue</span>
        </label>
      </>
    );
    footer = (
      <>
        <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancel</button>
        <button type="button" onClick={submitUrl} disabled={busy} className={BUTTON_PRIMARY}>
          {spinner}
          Continue
        </button>
      </>
    );
  } else if (step === 'verify' && domain) {
    body = (
      <>
        <p className="text-sm text-gray-700">
          Before we read anything on {domain.host}, show us it's yours. Add one of these, then press Verify.
        </p>
        <VerificationMethods domain={domain} />
      </>
    );
    footer = (
      <>
        <button type="button" onClick={() => { setError(''); setStep('url'); }} disabled={busy} className={BUTTON_SECONDARY}>Back</button>
        <button type="button" onClick={() => begin(url)} disabled={busy} className={BUTTON_PRIMARY}>
          {spinner}
          Verify
        </button>
      </>
    );
  } else if (step === 'progress') {
    const current = progressIndex(scan);
    body = (
      <>
        <ol className="space-y-3" aria-live="polite">
          {PROGRESS_STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.key} className="flex items-center gap-3" aria-current={active ? 'step' : undefined}>
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />
                ) : active && !pollStopped ? (
                  <Loader2 className="w-5 h-5 text-[#6C60FF] animate-spin flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" aria-hidden="true" />
                )}
                <span className={`text-sm ${active ? 'font-semibold text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        {pollTrouble && (
          <Notice tone="warning">We're having trouble reaching Stasht to check on progress. We'll keep trying. You can also close this window and come back later.</Notice>
        )}
        {!pollStopped && (
        <Notice tone="info">
          This usually takes 1–3 minutes. You can close this window: we keep working, and the Connectors page shows
          "Analysing…" until it's done.
        </Notice>
        )}
      </>
    );
    footer = close;
  } else if (step === 'outcome' && scan && outcome) {
    if (scan.status === 'ready') {
      const preview = outcome.preview.slice(0, PREVIEW_COUNT);
      body = (
        <>
          <p className="text-base font-semibold text-gray-900">{foundSummary(outcome)}</p>
          {preview.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {preview.map((item, i) => (
                <div key={`${item.url ?? item.title}-${i}`} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                  <div className="h-24 bg-gray-100">
                    <PreviewImage src={item.image_url} alt={item.title} />
                  </div>
                  <div className="p-2">
                    <p className="text-sm text-gray-900 font-medium line-clamp-2 break-words">{item.title}</p>
                    {item.price_label && (
                      <p className="text-xs font-semibold mt-0.5" style={{ color: WEBSITE_CATALOG_COLOR }}>{item.price_label}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-500">
            We import up to {plural(outcome.item_limit, 'item')} per website. Photos are copied to Stasht when you connect. The first import
            starts within a minute; a large catalogue can take an hour or more.
          </p>
        </>
      );
      footer = (
        <>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Not now</button>
          <button type="button" onClick={connect} disabled={busy} className={BUTTON_PRIMARY}>
            {spinner}
            Connect
          </button>
        </>
      );
    } else {
      const tone = scan.status === 'failed' ? 'error' : scan.status === 'unsupported' || scan.status === 'expired' ? 'neutral' : 'warning';
      body = (
        <>
          <Notice tone={tone}>{outcome.message}</Notice>
          {outcome.checks.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3 text-base">What we looked for</h3>
              <ul className="space-y-3">
                {outcome.checks.map((check) => (
                  <li key={check.method} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{check.label}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          check.found ? 'bg-green-50 text-green-700' : check.checked ? 'bg-yellow-50 text-yellow-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {check.found ? 'Found' : check.checked ? 'Not found' : "Couldn't check"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">We looked for</p>
                    <p className="font-mono text-xs text-gray-800 break-all">{check.looked_for}</p>
                    {check.where && (
                      <>
                        <p className="text-xs text-gray-500 mt-2">Where</p>
                        <p className="font-mono text-xs text-gray-800 break-all">{check.where}</p>
                      </>
                    )}
                    {check.in_body && (
                      <p className="text-xs text-yellow-800 mt-2">
                        We found your code in the page body. It only counts inside the &lt;head&gt; of your homepage.
                      </p>
                    )}
                    {check.note && <p className="text-xs text-gray-600 mt-2">{check.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome.blocked && <BlockedHelp blocked={outcome.blocked} />}
          {domain && outcome.can_check_again && scan.status === 'unverified' && (
            <details className="rounded-xl border border-gray-200 p-4">
              <summary className="text-sm font-semibold text-gray-900 cursor-pointer">How to add your verification code</summary>
              <div className="mt-4">
                <VerificationMethods domain={domain} />
              </div>
            </details>
          )}
        </>
      );
      // Start again wins over Try again: the address itself has to change (invalid or unsafe address, a redirect, an
      // expired check); Try again is only for a failure that may pass on a second run.
      footer = (
        <>
          {close}
          {outcome.can_check_again && (
            <button type="button" onClick={checkAgain} disabled={busy} className={BUTTON_PRIMARY}>
              {spinner}
              {scan.status === 'blocked' ? 'Retest' : 'Check again'}
            </button>
          )}
          {outcome.can_start_over ? (
            <button type="button" onClick={() => startOver(outcome.redirect_host ?? undefined)} disabled={busy} className={BUTTON_PRIMARY}>
              Start again
            </button>
          ) : (
            outcome.can_try_again && (
              <button type="button" onClick={() => begin(scan.url)} disabled={busy} className={BUTTON_PRIMARY}>
                {spinner}
                Try again
              </button>
            )
          )}
          {!outcome.can_start_over && (
            <button type="button" onClick={() => startOver()} disabled={busy} className={BUTTON_SECONDARY}>
              Use a different address
            </button>
          )}
        </>
      );
    }
  } else {
    // A state the dialog can't draw (e.g. a reopened scan without its record): start from the address.
    body = <Notice tone="neutral">Start by entering your website's address.</Notice>;
    footer = (
      <>
        {close}
        <button type="button" onClick={() => startOver()} className={BUTTON_PRIMARY}>Start</button>
      </>
    );
  }

  return (
    <CatalogueModalShell
      title={step === 'outcome' && scan?.status === 'ready' ? 'Your website is ready to connect' : 'Connect your website'}
      subtitle={step === 'url' || !host ? 'Import the catalogue from your own website' : host}
      onClose={onClose}
      footer={footer}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {body}
    </CatalogueModalShell>
  );
}
