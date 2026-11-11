import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Globe, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { newslettersAPI, type ListSignupForm, type ListSignupFormInput } from '../../../services/newslettersAPI';
import { Switch } from '../../ui/switch';
import SegmentedSwitch from '../../newsletters/SegmentedSwitch';
import { GENERIC_ERROR } from '../../newsletters/lib/apiResult';
import { BUTTON_SECONDARY, BUTTON_SMALL, BUTTON_SMALL_PRIMARY, LABEL, inputClass, textareaClass } from '../../newsletters/lib/ui';
import { ConfirmDialog, ErrorNote } from './ListDialogs';
import { SINGLE_OPT_IN_WARNING, fetchSnippet, htmlFormSnippet, parseDomains } from './signupSnippets';

type Example = 'html' | 'fetch';

/** Copies text; true when it worked (some browsers refuse without a click or on http). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`} className={`${BUTTON_SMALL} h-10 flex-shrink-0 md:h-9`}
      onClick={async () => {
        if (await copyText(text)) { setDone(true); window.setTimeout(() => setDone(false), 1500); } else toast.error('Copy didn’t work. Select the text and copy it instead.');
      }}>
      {done ? <Check className="h-4 w-4 text-green-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{done ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * A list's "Website signup form" (Royal Wood task 11): switch it on, copy the key and the form address, choose double
 * opt-in, allow redirect domains, regenerate the key, copy an example. Hidden when the API doesn't offer it yet
 * (older API, SQL not run, or the plan gate). Errors at the bottom of the card.
 */
export default function SignupFormSection({ listId, listName }: { listId: number; listName: string }) {
  const [form, setForm] = useState<ListSignupForm | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'enabled' | 'double_opt_in' | 'domains'>(null);
  const [domains, setDomains] = useState('');
  const [example, setExample] = useState<Example>('html');
  const [regenOpen, setRegenOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await newslettersAPI.signupForm(listId);
    if (res.ok && res.data && res.data.available) {
      setForm(res.data);
      setDomains(res.data.allowed_redirect_domains.join('\n'));
      setHidden(false);
    } else if (res.ok || res.status === 404 || res.status === 403) {
      setHidden(true); // not offered (yet), or the list is gone (ListDetail says so)
    } else {
      setError(res.error ?? GENERIC_ERROR);
    }
  }, [listId]);

  useEffect(() => { setForm(null); setError(null); setDomainsError(null); void load(); }, [load]);

  const save = async (input: ListSignupFormInput, what: NonNullable<typeof busy>) => {
    setBusy(what);
    setError(null);
    if (what === 'domains') setDomainsError(null);
    const res = await newslettersAPI.updateSignupForm(listId, input);
    setBusy(null);
    if (res.ok && res.data) {
      setForm(res.data);
      if (what === 'domains') { setDomains(res.data.allowed_redirect_domains.join('\n')); toast.success('Saved.'); }
      return;
    }
    if (what === 'domains' && res.fieldErrors.allowed_redirect_domains) setDomainsError(res.fieldErrors.allowed_redirect_domains);
    else setError(res.error ?? GENERIC_ERROR);
  };

  const regenerate = async (): Promise<string | null> => {
    const res = await newslettersAPI.regenerateSignupKey(listId);
    if (!res.ok || !res.data) return res.error ?? GENERIC_ERROR;
    setForm(res.data);
    toast.success('New key made. Update it on your website — the old key no longer works.');
    return null;
  };

  if (hidden) return null;

  const on = Boolean(form?.enabled);
  const key = form?.key ?? '';
  const endpoint = form?.endpoint_url ?? '';
  const snippet = example === 'html' ? htmlFormSnippet(endpoint, key) : fetchSnippet(endpoint, key);
  const domainsChanged = form ? parseDomains(domains).join('\n') !== form.allowed_redirect_domains.join('\n') : false;

  return (
    <section aria-labelledby={`signup-form-${listId}`} className="rounded-xl border border-gray-200 bg-white p-4 md:p-5" data-testid="list-signup-form">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100"><Globe className="h-5 w-5 text-[#6C60FF]" /></span>
          <div className="min-w-0">
            <h3 id={`signup-form-${listId}`} className="text-base font-semibold text-gray-900">Website signup form</h3>
            <p className="mt-0.5 text-sm text-gray-600">People who sign up for your newsletter on your website join &ldquo;{listName}&rdquo;.</p>
          </div>
        </div>
        {form ? (
          <div className="flex flex-shrink-0 items-center gap-2 pt-1">
            {busy === 'enabled' ? <Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" /> : null}
            <Switch checked={on} disabled={busy !== null} aria-label="Website signup form on" onCheckedChange={(v) => void save({ enabled: v }, 'enabled')} />
          </div>
        ) : null}
      </div>

      {form === null && !error ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading…</div>
      ) : null}

      {form && on && key ? (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <div>
            <label htmlFor={`signup-key-${listId}`} className={LABEL}>Signup key</label>
            <div className="flex gap-2">
              <input id={`signup-key-${listId}`} readOnly value={key} onFocus={(e) => e.currentTarget.select()} className={`${inputClass()} h-10 font-mono text-xs md:h-9 md:text-sm`} />
              <CopyButton text={key} label="signup key" />
            </div>
            <p className="mt-1 text-xs text-gray-500">It&rsquo;s fine for this key to be in your website&rsquo;s code: it can only add people to this list.</p>
          </div>

          <div>
            <label htmlFor={`signup-endpoint-${listId}`} className={LABEL}>Form address</label>
            <div className="flex gap-2">
              <input id={`signup-endpoint-${listId}`} readOnly value={endpoint} onFocus={(e) => e.currentTarget.select()} className={`${inputClass()} h-10 font-mono text-xs md:h-9 md:text-sm`} />
              <CopyButton text={endpoint} label="form address" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Ask people to confirm by email</p>
              <p className="mt-0.5 text-sm text-gray-600">Recommended. New people get an email from you and join only after they click the link in it.</p>
              {!form.double_opt_in ? <p role="note" className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-800">{SINGLE_OPT_IN_WARNING}</p> : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
              {busy === 'double_opt_in' ? <Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" /> : null}
              <Switch checked={form.double_opt_in} disabled={busy !== null} aria-label="Ask people to confirm by email" onCheckedChange={(v) => void save({ double_opt_in: v }, 'double_opt_in')} />
            </div>
          </div>

          <div>
            <label htmlFor={`signup-domains-${listId}`} className={LABEL}>Thank-you page websites <span className="font-normal text-gray-500">(optional)</span></label>
            <textarea id={`signup-domains-${listId}`} rows={2} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder={'royalwoodshop.com'}
              aria-invalid={Boolean(domainsError)} aria-describedby={`signup-domains-help-${listId}`} className={`${textareaClass(Boolean(domainsError))} text-base md:text-sm`} />
            {domainsError ? <p className="mt-1 text-sm text-red-600">{domainsError}</p> : null}
            <p id={`signup-domains-help-${listId}`} className="mt-1 text-xs text-gray-500">One per line. A plain HTML form can send people back to its own website, or to these websites.</p>
            {domainsChanged ? (
              <button type="button" disabled={busy !== null} onClick={() => void save({ allowed_redirect_domains: parseDomains(domains) }, 'domains')} className={`${BUTTON_SMALL_PRIMARY} mt-2 h-10 md:h-8`}>
                {busy === 'domains' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Save websites
              </button>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SegmentedSwitch<Example>
                label="Example"
                value={example}
                onChange={setExample}
                className="[&>button]:h-10 md:[&>button]:h-8"
                options={[{ value: 'html', label: 'HTML form' }, { value: 'fetch', label: 'JavaScript' }]}
              />
              <CopyButton text={snippet} label="example" />
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre rounded-lg bg-gray-900 p-3 text-xs leading-5 text-gray-100" data-testid="list-signup-snippet"><code>{snippet}</code></pre>
          </div>

          <button type="button" onClick={() => setRegenOpen(true)} disabled={busy !== null} className={`${BUTTON_SECONDARY} w-full md:w-auto`}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Regenerate key
          </button>
        </div>
      ) : null}

      {form && !on ? (
        <p className="mt-3 text-sm text-gray-600">{key ? 'Off: your website’s form can’t add anyone until you switch it back on (the key stays the same).' : 'Switch it on to get a key for your website’s newsletter form.'}</p>
      ) : null}

      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}

      <ConfirmDialog open={regenOpen} onOpenChange={setRegenOpen} title="Regenerate the signup key?" confirmLabel="Regenerate" onConfirm={regenerate}>
        <p>Your website&rsquo;s form stops working until you put the new key on it. Use this if the key is being misused.</p>
      </ConfirmDialog>
    </section>
  );
}
