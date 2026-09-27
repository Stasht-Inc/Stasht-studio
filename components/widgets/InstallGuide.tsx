import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, Copy, Info, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { widgetsAPI } from '../../services/widgetsAPI';
import type { ContactWidget } from '../../services/widgetsAPI';
import { copyText, installSnippet } from './widgetHelpers';
import {
  INSTALL_PLATFORMS, aiAssistantPrompt, developerEmailBody, developerEmailSubject,
} from './installGuideContent';
import type { InstallContext, PlatformId } from './installGuideContent';

const BRAND = '#6C60FF';

/** Renders **bold** segments of a step string. */
function rich(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-gray-900">{part}</strong> : part));
}

function SectionTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-base font-bold text-gray-900 mb-3">
      <span className="w-7 h-7 rounded-full text-white text-sm flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>{n}</span>
      {children}
    </h3>
  );
}

function CopyButton({ text, label, done, primary = false }: { text: string; label: string; done: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      toast.success(done);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={primary
        ? 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90'
        : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50'}
      style={primary ? { background: BRAND } : undefined}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/**
 * Step-by-step install instructions for one widget: readiness checklist, the code, per-platform
 * steps, an AI-assistant prompt, an email to the site's developer, and how to check it works.
 */
export function InstallGuide({
  widget,
  onBack,
  onEdit,
  onWidgetUpdated,
}: {
  widget: ContactWidget;
  onBack: () => void;
  onEdit: () => void;
  onWidgetUpdated: (w: ContactWidget) => void;
}) {
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [goingLive, setGoingLive] = useState(false);

  const snippet = installSnippet(widget.id);
  const selected = INSTALL_PLATFORMS.find((p) => p.id === platform) || null;
  const corner = widget.theme?.bubble_position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  const cornerText = corner === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  const isLive = widget.status === 'live';
  const hasDomain = (widget.allowed_domains?.length ?? 0) > 0;

  const ctx: InstallContext = useMemo(() => ({
    snippet,
    domain: widget.allowed_domains?.[0] || null,
    platformLabel: selected && selected.id !== 'managed' ? selected.label : null,
    corner,
  }), [snippet, widget.allowed_domains, selected, corner]);

  const prompt = aiAssistantPrompt(ctx);
  const emailBody = developerEmailBody(ctx);
  const mailto = `mailto:?subject=${encodeURIComponent(developerEmailSubject())}&body=${encodeURIComponent(emailBody)}`;

  const goLive = async () => {
    if (goingLive) return;
    setGoingLive(true);
    const res = await widgetsAPI.update(widget.id, { status: 'live' });
    setGoingLive(false);
    if (!res.ok || !res.data) {
      toast.error(res.error || 'Could not set the widget to Live.');
      return;
    }
    onWidgetUpdated(res.data);
    toast.success('Widget is now Live');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 flex-wrap">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> All widgets
        </button>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[16rem]">{widget.name}</span>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="text-sm text-gray-600">Install guide</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add this widget to your website</h2>
            <p className="text-sm text-gray-600 mt-1">
              It takes about 5 minutes. You paste one line of code into your website once, and the chat bubble appears on every page.
            </p>
          </div>

          {/* 1. Checklist */}
          <section>
            <SectionTitle n={1}>Before you start</SectionTitle>
            <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              <li className="flex items-start gap-3 p-4">
                {isLive
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  : <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-gray-900">{isLive ? 'The widget is Live' : `The widget is ${widget.status === 'paused' ? 'Paused' : 'a Draft'}`}</p>
                  <p className="text-gray-600">{isLive ? 'Visitors will see it as soon as the code is on your site.' : 'Visitors won\'t see it until it is Live.'}</p>
                </div>
                {!isLive && (
                  <button
                    type="button"
                    onClick={goLive}
                    disabled={goingLive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 flex-shrink-0"
                    style={{ background: BRAND }}
                  >
                    {goingLive && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Set to Live
                  </button>
                )}
              </li>
              <li className="flex items-start gap-3 p-4">
                {hasDomain
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  : <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />}
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-gray-900">
                    {hasDomain ? `Your website is added: ${widget.allowed_domains.join(', ')}` : 'Add your website\'s domain (recommended)'}
                  </p>
                  <p className="text-gray-600">
                    {hasDomain ? 'Messages from other websites are flagged for us.' : 'It helps us flag messages that come from somewhere other than your website.'}
                  </p>
                </div>
                {!hasDomain && (
                  <button type="button" onClick={onEdit} className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 flex-shrink-0">
                    Add domain
                  </button>
                )}
              </li>
              <li className="flex items-start gap-3 p-4">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-gray-900">You can log in to edit your website, or know who manages it</p>
                  <p className="text-gray-600">If someone else looks after your site, skip to step 4 and send them the instructions.</p>
                </div>
              </li>
            </ul>
          </section>

          {/* 2. Code */}
          <section>
            <SectionTitle n={2}>Copy your install code</SectionTitle>
            <p className="text-sm text-gray-600 mb-3">
              This one line tells your website to show the chat bubble. Paste it exactly as it is. Don't change anything in it.
            </p>
            <pre
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[12px] text-gray-800 overflow-x-auto whitespace-pre-wrap break-all select-all"
              aria-label="Install code"
            >
              {snippet}
            </pre>
            <div className="mt-3">
              <CopyButton text={snippet} label="Copy install code" done="Install code copied" primary />
            </div>
          </section>

          {/* 3. Platform steps */}
          <section>
            <SectionTitle n={3}>Paste it into your website</SectionTitle>
            <p className="text-sm text-gray-600 mb-3">Where is your website built? Choose one to see the exact steps.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Website platform">
              {INSTALL_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={platform === p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    platform === p.id ? 'border-[#6C60FF] bg-[#6C60FF]/10 text-[#4a40d4]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {selected ? (
              <div className="mt-4 rounded-xl border border-gray-200 p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-2">{selected.label}</h4>
                {selected.note && (
                  <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" /> {selected.note}
                  </p>
                )}
                <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                  {selected.steps.map((s) => <li key={s}>{rich(s)}</li>)}
                </ol>
                <p className="text-xs text-gray-500 mt-3">Menu names can differ slightly if your website platform has updated its layout.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Not sure? Choose "Someone else manages my site", or ask your AI assistant in step 4.</p>
            )}
          </section>

          {/* 4. Help */}
          <section>
            <SectionTitle n={4}>Get help if you need it</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bot className="w-5 h-5 text-[#6C60FF]" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-gray-900">Ask your AI assistant</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Copy this prompt and paste it into ChatGPT, Claude, Gemini or Copilot. It will walk you through it for your website{selected && selected.id !== 'managed' ? ` on ${selected.label}` : ''}.
                </p>
                <div className="mt-3">
                  <CopyButton text={prompt} label="Copy AI prompt" done="Prompt copied. Paste it into your AI assistant." primary />
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Preview the prompt</summary>
                  <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-[12px] text-gray-800 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{prompt}</pre>
                </details>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Mail className="w-5 h-5 text-[#6C60FF]" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-gray-900">Send to your web developer</h4>
                </div>
                <p className="text-sm text-gray-600">
                  Opens your email with the code and instructions ready to send to whoever manages your website.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mailto}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                    style={{ background: BRAND }}
                  >
                    <Mail className="w-4 h-4" /> Email my web developer
                  </a>
                  <CopyButton text={emailBody} label="Copy message" done="Message copied" />
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Preview the message</summary>
                  <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-[12px] text-gray-800 whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{emailBody}</pre>
                </details>
              </div>
            </div>
          </section>

          {/* 5. Check */}
          <section>
            <SectionTitle n={5}>Check it's working</SectionTitle>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
              <li>Open your website in a new browser tab and refresh the page.</li>
              <li>
                Within a few seconds, a chat bubble saying <strong className="font-semibold text-gray-900">"{widget.callout_text || 'Chat with us'}"</strong> should appear in the {cornerText} corner.
              </li>
              <li>Click it and send yourself a test message. It will show up in your <strong className="font-semibold text-gray-900">Leads</strong>.</li>
            </ol>
            <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Not seeing the bubble?</p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700">
                <li>Make sure the widget is <strong className="font-semibold text-gray-900">Live</strong> (step 1).</li>
                <li>Make sure you saved <em>and published</em> the change on your website.</li>
                <li>Clear your website's cache if it has one (caching plugins, Cloudflare), then wait a few minutes.</li>
                <li>Try a private or incognito window, in case your browser is showing an old copy of the page.</li>
                <li>Check the code was pasted exactly as copied, with nothing missing at the start or end.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
