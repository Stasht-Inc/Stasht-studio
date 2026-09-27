import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowLeft, Camera, Check, ChevronDown, Code2, Copy, Loader2, MessageCircle, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { widgetsAPI } from '../../services/widgetsAPI';
import type {
  ContactWidget, ContactWidgetInput, FormFieldKey, FormFieldSetting, FormFieldSettings, WidgetBubblePosition, WidgetStatus,
  WidgetTeamOption,
} from '../../services/widgetsAPI';
import { useAuth } from '../../contexts/AuthContext';
import { WidgetPreview } from './WidgetPreview';
import { InstallGuide } from './InstallGuide';
import { InstallStatusLine } from './InstallStatus';
import {
  DEFAULT_BRAND, DEFAULT_FORM_FIELD_SETTINGS, FORM_FIELD_KEYS, FORM_FIELD_LABEL_MAX, FORM_FIELD_NAMES, WELCOME_MAX, copyText,
  formCanReply, installSnippet, isHexColor, isPlausibleDomain, normalizeDomain, resolveFormFields, safeColor,
  safeHttpsUrl, squareAvatarDataUrl,
} from './widgetHelpers';

const BRAND = '#6C60FF';
const REPLY_RULE = 'Make Mobile number or Email required, so every visitor leaves a way for you to reply.';
const CALLOUT_MAX = 60;
const AGENT_MAX = 40;
const NAME_MAX = 80;

const STATUS_META: Record<WidgetStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'Live', dot: 'bg-green-500', text: 'text-green-700' },
  draft: { label: 'Draft', dot: 'bg-gray-400', text: 'text-gray-600' },
  paused: { label: 'Paused', dot: 'bg-amber-500', text: 'text-amber-700' },
};

// ---------------------------------------------------------------------------
// Form state <-> API
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  agentName: string;
  calloutText: string;
  welcomeSubtext: string;
  primaryColor: string; // '' = embed default
  logoUrl: string;
  position: WidgetBubblePosition;
  domains: string[];
  status: WidgetStatus;
  formFields: FormFieldSettings;
  propertyId: number | null; // the dealership whose team takes over leads; null = only the owner
}

const emptyForm: FormState = {
  name: '',
  agentName: '',
  calloutText: '',
  welcomeSubtext: '',
  primaryColor: DEFAULT_BRAND,
  logoUrl: '',
  position: 'bottom-right',
  domains: [],
  status: 'draft',
  formFields: resolveFormFields(null),
  propertyId: null,
};

function formFromWidget(w: ContactWidget): FormState {
  return {
    name: w.name || '',
    agentName: w.agent_name || '',
    calloutText: w.callout_text || '',
    welcomeSubtext: w.welcome_subtext || '',
    primaryColor: w.theme?.primary_color || '',
    logoUrl: w.theme?.logo_url || '',
    position: w.theme?.bubble_position === 'bottom-left' ? 'bottom-left' : 'bottom-right',
    domains: [...(w.allowed_domains || [])],
    status: w.status || 'draft',
    formFields: resolveFormFields(w.form_fields),
    propertyId: w.property_id ?? null,
  };
}

// withTeam: only send property_id when the owner has dealerships to choose from.
function inputFromForm(f: FormState, domains: string[], withTeam: boolean): ContactWidgetInput {
  return {
    ...(withTeam ? { property_id: f.propertyId } : {}),
    name: f.name.trim(),
    status: f.status,
    agent_name: f.agentName.trim(),
    callout_text: f.calloutText.trim(),
    welcome_subtext: f.welcomeSubtext.trim(),
    theme: {
      primary_color: f.primaryColor.trim() || null,
      logo_url: f.logoUrl.trim() || null,
      bubble_position: f.position,
    },
    allowed_domains: domains,
    form_fields: Object.fromEntries(FORM_FIELD_KEYS.map((k) => [k, { ...f.formFields[k], label: f.formFields[k].label.trim() }])),
  };
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: WidgetStatus }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${meta.text}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function InstallSnippetBox({ widgetId, onOpenGuide }: { widgetId: string; onOpenGuide: () => void }) {
  const snippet = installSnippet(widgetId);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyText(snippet);
    if (ok) {
      setCopied(true);
      toast.success('Install code copied');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy. Select the code and copy it manually.');
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900">Install on your website</h3>
      <p className="text-xs text-gray-600 mt-1">
        Paste this before the closing <span className="font-mono">&lt;/body&gt;</span> tag on every page where you want the widget to appear.
      </p>
      <pre
        className="mt-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[12px] text-gray-800 overflow-x-auto whitespace-pre-wrap break-all select-all"
        aria-label="Install code"
      >
        {snippet}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ background: BRAND }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy install code'}
        </button>
        <button
          type="button"
          onClick={onOpenGuide}
          className="text-sm font-semibold text-[#4a40d4] hover:underline"
        >
          Step-by-step install instructions
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        The widget only shows on your site when its status is Live.
      </p>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs text-red-600 mt-1">{message}</p>;
}

const inputClass =
  'w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/40 focus:border-[#6C60FF]';
const errorInputClass = ' !border-red-400 !bg-red-50';

// Native <select> arrows ignore padding and sit on the edge; draw our own chevron instead.
function SelectField({ wrapperClassName = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select {...props} className={inputClass + ' appearance-none pr-10 cursor-pointer'}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function WidgetBuilder({
  widget,
  onBack,
  onSaved,
  onDeleted,
  onDirtyChange,
  onOpenGuide,
  teamOptions,
}: {
  teamOptions: WidgetTeamOption[];
  widget: ContactWidget | null; // null = creating
  onBack: () => void;
  onSaved: (w: ContactWidget, created: boolean) => void;
  onDeleted: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onOpenGuide: (w: ContactWidget) => void;
}) {
  const uid = useId();
  const [saved, setSaved] = useState<ContactWidget | null>(widget);
  // A new widget starts on the owner's only dealership (the server does the same).
  const baseline = useMemo(
    () => (saved ? formFromWidget(saved) : { ...emptyForm, propertyId: teamOptions.length === 1 ? teamOptions[0].id : null }),
    [saved, teamOptions],
  );
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(baseline);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewMode, setPreviewMode] = useState<'closed' | 'open'>('open');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const onAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('That image is too large. Choose one under 15 MB.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await widgetsAPI.uploadAvatar(await squareAvatarDataUrl(file));
      if (res.ok && res.data?.url) {
        set('logoUrl', res.data.url);
      } else {
        toast.error(res.error || 'Could not upload the avatar.');
      }
    } catch {
      toast.error('Could not read that image. Try another one.');
    } finally {
      setUploadingAvatar(false);
    }
  };
  // The preview shows you as the online team member; visitors see whoever is really online.
  const previewOnline = useMemo(() => {
    const full = (user?.name || 'You').trim();
    const words = full.split(/\s+/).filter(Boolean);
    const initials = ((words[0]?.[0] || 'Y') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
    return [{ name: words[0] || 'You', initials, color: user?.profile_color || '#6C60FF', avatarUrl: user?.avatar || null }];
  }, [user]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline) || domainInput.trim() !== '',
    [form, baseline, domainInput],
  );
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const map: Record<string, string> = {
        name: 'name', agentName: 'agent_name', calloutText: 'callout_text', welcomeSubtext: 'welcome_subtext',
        primaryColor: 'theme.primary_color', logoUrl: 'theme.logo_url', position: 'theme.bubble_position',
        domains: 'allowed_domains', status: 'status', formFields: 'form_fields', propertyId: 'property_id',
      };
      if (!e[map[key]]) return e;
      const { [map[key]]: _drop, ...rest } = e;
      return rest;
    });
  };

  // Returns the domain list including anything typed but not yet added; null if the pending text is invalid.
  const addDomain = (raw: string, current: string[]): string[] | null => {
    const domain = normalizeDomain(raw);
    if (!domain) return current;
    if (!isPlausibleDomain(domain)) {
      setDomainError(`"${raw.trim()}" doesn't look like a domain. Use something like example.com.`);
      return null;
    }
    setDomainError('');
    return current.includes(domain) ? current : [...current, domain];
  };

  const commitDomain = () => {
    const next = addDomain(domainInput, form.domains);
    if (next === null) return;
    set('domains', next);
    setDomainInput('');
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Give the widget a name.';
    if (form.primaryColor.trim() && !isHexColor(form.primaryColor)) e['theme.primary_color'] = 'Use a hex color like #2f5fac.';
    if (form.logoUrl.trim()) {
      try {
        if (new URL(form.logoUrl.trim()).protocol !== 'https:') e['theme.logo_url'] = 'The avatar link must start with https://';
      } catch {
        e['theme.logo_url'] = 'Enter a full URL starting with https://';
      }
    }
    if (form.welcomeSubtext.length > WELCOME_MAX) e.welcome_subtext = `Keep this under ${WELCOME_MAX} characters.`;
    if (!formCanReply(form.formFields)) e.form_fields = REPLY_RULE;
    return e;
  };

  const save = async () => {
    if (saving) return;
    const domains = addDomain(domainInput, form.domains);
    if (domains === null) return;
    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    const payload = inputFromForm(form, domains, teamOptions.length > 0);
    const res = saved ? await widgetsAPI.update(saved.id, payload) : await widgetsAPI.create(payload);
    setSaving(false);

    if (!res.ok || !res.data) {
      setErrors(res.fieldErrors);
      if (res.fieldErrors.allowed_domains) setDomainError(res.fieldErrors.allowed_domains);
      toast.error(res.error || 'Could not save the widget.');
      return;
    }

    const created = !saved;
    setSaved(res.data);
    setForm(formFromWidget(res.data));
    setDomainInput('');
    setDomainError('');
    setErrors({});
    // A new widget sends the manager back to the list (this builder unmounts), which has its own toast.
    onSaved(res.data, created);
    if (!created) toast.success('Widget saved');
  };

  const remove = async () => {
    if (!saved || deleting) return;
    setDeleting(true);
    const res = await widgetsAPI.remove(saved.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error || 'Could not delete the widget.');
      setConfirmingDelete(false);
      return;
    }
    toast.success('Widget deleted');
    onDeleted(saved.id);
  };

  const onDomainKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDomain();
    } else if (e.key === 'Backspace' && !domainInput && form.domains.length) {
      set('domains', form.domains.slice(0, -1));
    }
  };

  const setField = (key: FormFieldKey, patch: Partial<FormFieldSetting>) => {
    const next = { ...form.formFields[key], ...patch };
    if (!next.show) next.required = false;
    set('formFields', { ...form.formFields, [key]: next });
  };
  const formFieldsError = errors.form_fields
    || Object.entries(errors).find(([k]) => k.startsWith('form_fields.'))?.[1];

  const busy = saving || deleting;
  const liveWithoutDomain = form.status === 'live' && form.domains.length === 0 && !domainInput.trim();
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Builder header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> All widgets
        </button>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[16rem]">
          {saved ? saved.name : 'New widget'}
        </span>
        {saved && <StatusBadge status={saved.status} />}
        <div className="ml-auto flex items-center gap-2">
          {saved && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {saved && confirmingDelete && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5" role="alert">
              <span className="text-sm text-red-700">Delete this widget? Its install code will stop working.</span>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-white"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ background: BRAND }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? 'Save changes' : 'Save widget'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] gap-8 p-6">
          {/* Form column */}
          <form
            className="space-y-5 min-w-0"
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            noValidate
          >
            <div>
              <label htmlFor={id('name')} className="block text-sm font-medium text-gray-800 mb-1.5">
                Widget name<span className="text-red-500">*</span>
              </label>
              <input
                id={id('name')}
                type="text"
                value={form.name}
                maxLength={NAME_MAX}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Homepage widget"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? id('name-err') : id('name-help')}
                className={inputClass + (errors.name ? errorInputClass : '')}
              />
              <p id={id('name-help')} className="text-xs text-gray-400 mt-1">Only you see this. It helps you tell widgets apart.</p>
              <FieldError id={id('name-err')} message={errors.name} />
            </div>

            {/* Agent name and photo together — upload only; a default avatar shows until one is added. */}
            <div>
              <label htmlFor={id('agent')} className="block text-sm font-medium text-gray-800 mb-1.5">Agent name and photo</label>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label={form.logoUrl ? 'Change agent photo' : 'Upload agent photo'}
                  title={form.logoUrl ? 'Change photo' : 'Upload photo'}
                  className="relative w-14 h-14 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2 disabled:opacity-70"
                >
                  {safeHttpsUrl(form.logoUrl) ? (
                    <img src={safeHttpsUrl(form.logoUrl)!} alt="Agent avatar" className="w-14 h-14 rounded-full object-cover border border-gray-200 bg-white" />
                  ) : (
                    <span className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center" aria-label="Default avatar">
                      <UserRound className="w-7 h-7 text-gray-400" aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full text-white flex items-center justify-center ring-2 ring-white" style={{ background: BRAND }} aria-hidden="true">
                    {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </span>
                </button>
                <div className="flex-1 min-w-0">
                  <input
                    id={id('agent')}
                    type="text"
                    value={form.agentName}
                    maxLength={AGENT_MAX}
                    onChange={(e) => set('agentName', e.target.value)}
                    placeholder="Sarah"
                    aria-invalid={!!errors.agent_name}
                    aria-describedby={errors.agent_name ? id('agent-err') : id('avatar-help')}
                    className={inputClass + (errors.agent_name ? errorInputClass : '')}
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => avatarInput.current?.click()}
                      disabled={uploadingAvatar}
                      className="text-sm font-semibold hover:underline disabled:opacity-60"
                      style={{ color: '#5A4FE5' }}
                    >
                      {uploadingAvatar ? 'Uploading…' : form.logoUrl ? 'Change photo' : 'Upload photo'}
                    </button>
                    {form.logoUrl && !uploadingAvatar && (
                      <button type="button" onClick={() => set('logoUrl', '')} className="text-sm font-medium text-gray-500 hover:text-gray-800 hover:underline">
                        Remove photo
                      </button>
                    )}
                    <span id={id('avatar-help')} className="text-xs text-gray-400">JPG, PNG or WebP. A default avatar shows until you add one.</span>
                  </div>
                  <FieldError id={id('agent-err')} message={errors.agent_name} />
                  <FieldError id={id('logo-err')} message={errors['theme.logo_url']} />
                </div>
                <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onAvatarPicked} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor={id('callout')} className="block text-sm font-medium text-gray-800 mb-1.5">Callout text</label>
                <input
                  id={id('callout')}
                  type="text"
                  value={form.calloutText}
                  maxLength={CALLOUT_MAX}
                  onChange={(e) => set('calloutText', e.target.value)}
                  placeholder="Ask us a question!"
                  aria-invalid={!!errors.callout_text}
                  aria-describedby={errors.callout_text ? id('callout-err') : id('callout-count')}
                  className={inputClass + (errors.callout_text ? errorInputClass : '')}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400">Shown on the closed bubble.</p>
                  <span id={id('callout-count')} className="text-xs text-gray-400">{form.calloutText.length}/{CALLOUT_MAX}</span>
                </div>
                <FieldError id={id('callout-err')} message={errors.callout_text} />
              </div>
            </div>

            <div>
              <label htmlFor={id('welcome')} className="block text-sm font-medium text-gray-800 mb-1.5">Welcome sub-text</label>
              <textarea
                id={id('welcome')}
                value={form.welcomeSubtext}
                maxLength={WELCOME_MAX}
                rows={4}
                onChange={(e) => set('welcomeSubtext', e.target.value)}
                placeholder="To speak with a live agent, reach out during our regular business hours (Mon-Fri, 7:00am-5:30pm)."
                aria-invalid={!!errors.welcome_subtext}
                aria-describedby={errors.welcome_subtext ? id('welcome-err') : id('welcome-count')}
                className={inputClass + ' resize-y' + (errors.welcome_subtext ? errorInputClass : '')}
              />
              <div className="flex justify-end mt-1">
                <span id={id('welcome-count')} className="text-xs text-gray-400">{form.welcomeSubtext.length}/{WELCOME_MAX}</span>
              </div>
              <FieldError id={id('welcome-err')} message={errors.welcome_subtext} />
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-gray-800 mb-1">Form fields</legend>
              <p className="text-xs text-gray-400 mb-2">
                Choose what visitors fill in and rename any label. Mobile number or Email must be required so you can always reply.
              </p>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                <div className="hidden sm:grid grid-cols-[7.5rem_minmax(0,1fr)_10rem] gap-3 px-3 py-2 text-xs font-semibold text-gray-500">
                  <span>Field</span>
                  <span>Label visitors see</span>
                  <span className="grid grid-cols-2 text-center"><span>Show</span><span>Required</span></span>
                </div>
                {FORM_FIELD_KEYS.map((key) => {
                  const f = form.formFields[key];
                  const name = FORM_FIELD_NAMES[key];
                  return (
                    <div key={key} className="grid grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[7.5rem_minmax(0,1fr)_10rem] gap-x-3 gap-y-2 items-center px-3 py-2.5">
                      <span className={`text-sm font-medium ${f.show ? 'text-gray-900' : 'text-gray-400'}`}>{name}</span>
                      <input
                        type="text"
                        value={f.label}
                        maxLength={FORM_FIELD_LABEL_MAX}
                        disabled={!f.show}
                        onChange={(e) => setField(key, { label: e.target.value })}
                        placeholder={DEFAULT_FORM_FIELD_SETTINGS[key].label}
                        aria-label={`${name}: label visitors see`}
                        className={inputClass + ' !py-1.5 disabled:opacity-50'}
                      />
                      <div className="col-span-2 sm:col-span-1 flex gap-5 sm:grid sm:grid-cols-2 sm:gap-0">
                        <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 sm:justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.show}
                            onChange={(e) => setField(key, { show: e.target.checked })}
                            aria-label={`Show ${name}`}
                            className="w-4 h-4 accent-[#6C60FF]"
                          />
                          <span className="sm:sr-only">Show</span>
                        </label>
                        <label className={`inline-flex items-center gap-1.5 text-sm sm:justify-center ${f.show ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}>
                          <input
                            type="checkbox"
                            checked={f.required}
                            disabled={!f.show}
                            onChange={(e) => setField(key, { required: e.target.checked })}
                            aria-label={`${name} required`}
                            className="w-4 h-4 accent-[#6C60FF] disabled:opacity-40"
                          />
                          <span className="sm:sr-only">Required</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!formCanReply(form.formFields) && !formFieldsError && (
                <p className="text-xs text-amber-700 mt-1">{REPLY_RULE}</p>
              )}
              <FieldError id={id('fields-err')} message={formFieldsError} />
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor={id('color-hex')} className="block text-sm font-medium text-gray-800 mb-1.5">Brand color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick brand color"
                    value={safeColor(form.primaryColor)}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    className="h-10 w-12 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"
                  />
                  <input
                    id={id('color-hex')}
                    type="text"
                    value={form.primaryColor}
                    maxLength={7}
                    onChange={(e) => set('primaryColor', e.target.value)}
                    placeholder={DEFAULT_BRAND}
                    spellCheck={false}
                    aria-invalid={!!errors['theme.primary_color']}
                    aria-describedby={errors['theme.primary_color'] ? id('color-err') : undefined}
                    className={inputClass + ' font-mono' + (errors['theme.primary_color'] ? errorInputClass : '')}
                  />
                </div>
                <FieldError id={id('color-err')} message={errors['theme.primary_color']} />
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-gray-800 mb-1.5">Position</legend>
                <div className="flex gap-4 pt-2">
                  {([['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']] as const).map(([value, label]) => (
                    <label key={value} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={id('position')}
                        value={value}
                        checked={form.position === value}
                        onChange={() => set('position', value)}
                        className="accent-[#6C60FF]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <FieldError id={id('position-err')} message={errors['theme.bubble_position']} />
              </fieldset>
            </div>

            <div>
              <label htmlFor={id('domain')} className="block text-sm font-medium text-gray-800 mb-1.5">Allowed domains</label>
              {form.domains.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-2" aria-label="Allowed domains">
                  {form.domains.map((d) => (
                    <li key={d} className="inline-flex items-center gap-1.5 bg-[#6C60FF]/10 text-[#4a40d4] rounded-full pl-3 pr-1.5 py-1 text-sm font-medium">
                      {d}
                      <button
                        type="button"
                        aria-label={`Remove ${d}`}
                        onClick={() => set('domains', form.domains.filter((x) => x !== d))}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#6C60FF]/20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  id={id('domain')}
                  type="text"
                  value={domainInput}
                  onChange={(e) => { setDomainInput(e.target.value); if (domainError) setDomainError(''); }}
                  onKeyDown={onDomainKey}
                  onBlur={() => { if (domainInput.trim()) commitDomain(); }}
                  placeholder="example.com"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!(domainError || errors.allowed_domains)}
                  aria-describedby={id('domain-help') + ((domainError || errors.allowed_domains) ? ' ' + id('domain-err') : '')}
                  className={inputClass + ((domainError || errors.allowed_domains) ? errorInputClass : '')}
                />
                {/* Turns purple once something is typed, so it's clear the domain still needs adding. */}
                <button
                  type="button"
                  onClick={commitDomain}
                  className={`inline-flex items-center gap-1.5 px-4 rounded-xl border text-sm font-medium flex-shrink-0 transition-colors ${
                    domainInput.trim()
                      ? 'border-transparent bg-[#6C60FF] text-white hover:bg-[#5A4FE5]'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <p id={id('domain-help')} className="text-xs text-gray-400 mt-1">
                The domain(s) of the site where the widget will be installed, e.g. example.com. Press Enter to add each one.
              </p>
              <FieldError id={id('domain-err')} message={domainError || errors.allowed_domains} />
            </div>

            {teamOptions.length > 0 && (
              <div>
                <label htmlFor={id('team')} className="block text-sm font-medium text-gray-800 mb-1.5">Who handles this widget's leads</label>
                <SelectField
                  id={id('team')}
                  value={form.propertyId ?? ''}
                  onChange={(e) => set('propertyId', e.target.value === '' ? null : Number(e.target.value))}
                  aria-describedby={id('team-help')}
                  wrapperClassName="sm:max-w-xs"
                >
                  {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name} team</option>)}
                  <option value="">Only me</option>
                </SelectField>
                <p id={id('team-help')} className="text-xs text-gray-400 mt-1">
                  {form.propertyId
                    ? 'Everyone on the team is alerted to new leads, the first to accept takes the lead, and the widget shows who is online.'
                    : 'New leads go to you only.'}
                </p>
                <FieldError id={id('team-err')} message={errors.property_id} />
              </div>
            )}

            <div>
              <label htmlFor={id('status')} className="block text-sm font-medium text-gray-800 mb-1.5">Status</label>
              <SelectField
                id={id('status')}
                value={form.status}
                onChange={(e) => set('status', e.target.value as WidgetStatus)}
                aria-describedby={id('status-help')}
                wrapperClassName="sm:max-w-xs"
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
              </SelectField>
              <p id={id('status-help')} className="text-xs text-gray-400 mt-1">Live widgets appear on the site. Draft and Paused widgets are hidden from visitors.</p>
              {liveWithoutDomain && (
                <p className="text-xs text-amber-700 mt-1">Tip: add your website's domain above so we can flag messages sent from other sites.</p>
              )}
              <FieldError id={id('status-err')} message={errors.status} />
            </div>

            <p className="text-xs text-gray-400 pt-1">Coming soon: business hours and AI replies.</p>

            {/* Submit on Enter from single-line inputs */}
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" disabled={busy}>Save</button>
          </form>

          {/* Preview + install column */}
          <div className="space-y-5 min-w-0">
            {/* Install box first once saved: it's what the user needs next. (The preview used to be
                sticky, which left this box stuck underneath it and unclickable.) */}
            {saved ? (
              <InstallSnippetBox widgetId={saved.id} onOpenGuide={() => onOpenGuide(saved)} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Save the widget to get your install code.
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900">Live preview</h3>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50" role="group" aria-label="Preview state">
                  {(['open', 'closed'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={previewMode === mode}
                      onClick={() => setPreviewMode(mode)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        previewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {mode === 'open' ? 'Opened panel' : 'Closed launcher'}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-100 to-gray-50 p-4 overflow-hidden"
                style={{ minHeight: previewMode === 'open' ? 620 : 200 }}
              >
                <div className="space-y-2 mb-4 opacity-60" aria-hidden="true">
                  <div className="h-3 w-1/3 rounded bg-gray-300" />
                  <div className="h-2.5 w-full rounded bg-gray-200" />
                  <div className="h-2.5 w-5/6 rounded bg-gray-200" />
                </div>
                <div style={{ minHeight: previewMode === 'open' ? 540 : 120 }} className="flex">
                  <div className="w-full">
                    <WidgetPreview
                      mode={previewMode}
                      values={{
                        agentName: form.agentName,
                        calloutText: form.calloutText,
                        welcomeSubtext: form.welcomeSubtext,
                        primaryColor: form.primaryColor,
                        logoUrl: form.logoUrl,
                        position: form.position,
                        formFields: form.formFields,
                        online: previewOnline,
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">This is how visitors will see the widget on your site.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager modal
// ---------------------------------------------------------------------------

export function ContactWidgetManager({
  onClose,
  onWidgetsChange,
}: {
  onClose: () => void;
  // Called with the current list after it loads and after every create/save/delete.
  onWidgetsChange?: (widgets: ContactWidget[]) => void;
}) {
  const [widgets, setWidgets] = useState<ContactWidget[] | null>(null);
  const [teamOptions, setTeamOptions] = useState<WidgetTeamOption[]>([]);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'list' | 'builder' | 'install'>('list');
  const [editing, setEditing] = useState<ContactWidget | null>(null);
  const [installing, setInstalling] = useState<ContactWidget | null>(null);
  // Bumped each time the builder opens so it always starts from fresh state.
  const [builderKey, setBuilderKey] = useState(0);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const setDirty = useCallback((d: boolean) => { dirtyRef.current = d; }, []);

  const load = useCallback(async () => {
    setLoadError('');
    setWidgets(null);
    const res = await widgetsAPI.listWithTeams();
    if (!res.ok || !res.data) {
      setLoadError(res.error || 'Could not load your widgets.');
      return;
    }
    setTeamOptions(res.data.teamOptions);
    setWidgets(res.data.widgets);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onWidgetsChangeRef = useRef(onWidgetsChange);
  onWidgetsChangeRef.current = onWidgetsChange;
  useEffect(() => {
    if (widgets) onWidgetsChangeRef.current?.(widgets);
  }, [widgets]);

  const confirmDiscard = () => !dirtyRef.current || window.confirm('You have unsaved changes. Discard them?');

  const requestClose = useCallback(() => {
    if (confirmDiscard()) onClose();
  }, [onClose]);

  const openBuilder = (w: ContactWidget | null) => {
    setJustCreatedId(null);
    setEditing(w);
    setBuilderKey((k) => k + 1);
    setView('builder');
  };

  // Most accounts have one widget: with none yet, skip the empty list and open the
  // builder. First load only — deleting your last widget later returns to the list.
  const firstLoadHandled = useRef(false);
  useEffect(() => {
    if (widgets === null || firstLoadHandled.current) return;
    firstLoadHandled.current = true;
    if (widgets.length === 0) openBuilder(null);
  }, [widgets]);

  const backToList = () => {
    if (!confirmDiscard()) return;
    dirtyRef.current = false;
    setView('list');
    setEditing(null);
    setInstalling(null);
  };

  const openInstall = (w: ContactWidget) => {
    if (!confirmDiscard()) return;
    dirtyRef.current = false;
    setJustCreatedId(null);
    setEditing(null);
    setInstalling(w);
    setView('install');
  };

  const handleInstallUpdated = (w: ContactWidget) => {
    setInstalling(w);
    setWidgets((list) => (list || []).map((x) => (x.id === w.id ? w : x)));
  };

  // Escape to close, Tab focus trap, focus restore on unmount.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [requestClose]);

  const handleSaved = (w: ContactWidget, created: boolean) => {
    setWidgets((list) => {
      const current = list || [];
      return created ? [w, ...current.filter((x) => x.id !== w.id)] : current.map((x) => (x.id === w.id ? w : x));
    });
    if (!created) {
      setEditing(w);
      return;
    }
    // New widget: back to the list, with the new row highlighted and its install code one click away.
    dirtyRef.current = false;
    setEditing(null);
    setJustCreatedId(w.id);
    setView('list');
    toast.success('Widget created. Click "Install" for step-by-step instructions to add it to your site.');
  };

  const handleDeleted = (id: string) => {
    dirtyRef.current = false;
    setWidgets((list) => (list || []).filter((x) => x.id !== id));
    setEditing(null);
    setView('list');
  };


  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] h-[92vh] flex flex-col shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(145deg, #8B80FF, #6C60FF)' }}
            >
              <MessageCircle className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-gray-900">Contact Us Widget</h2>
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">
                A chat-style contact form for your own website. Leads land in your Leads inbox.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0 mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'install' && installing ? (
          <InstallGuide
            widget={installing}
            onBack={backToList}
            onEdit={() => openBuilder(installing)}
            onWidgetUpdated={handleInstallUpdated}
          />
        ) : view === 'builder' ? (
          <WidgetBuilder
            key={builderKey}
            widget={editing}
            onBack={backToList}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onDirtyChange={setDirty}
            onOpenGuide={openInstall}
            teamOptions={teamOptions}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Your widgets</h3>
              <button
                type="button"
                onClick={() => openBuilder(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                style={{ background: BRAND }}
              >
                <Plus className="w-4 h-4" /> New widget
              </button>
            </div>

            {widgets === null && !loadError && (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm" role="status">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading your widgets...
              </div>
            )}

            {loadError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center justify-between gap-3" role="alert">
                <span>{loadError}</span>
                <button type="button" onClick={() => void load()} className="font-semibold underline flex-shrink-0">Try again</button>
              </div>
            )}

            {widgets !== null && widgets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 py-14 px-6 text-center">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(145deg, #8B80FF, #6C60FF)' }}
                >
                  <MessageCircle className="w-7 h-7 text-white" aria-hidden="true" />
                </div>
                <h4 className="text-lg font-bold text-gray-900">Create your first Contact Us widget</h4>
                <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">
                  Pick your colors and greeting, paste one line of code on your website, and new enquiries arrive in your Leads inbox.
                </p>
                <button
                  type="button"
                  onClick={() => openBuilder(null)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: BRAND }}
                >
                  <Plus className="w-4 h-4" /> Create widget
                </button>
              </div>
            )}

            {widgets !== null && widgets.length > 0 && (
              <ul className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {widgets.map((w) => (
                  <li
                    key={w.id}
                    className={`flex items-center gap-4 px-5 py-4 flex-wrap ${w.id === justCreatedId ? 'bg-[#6C60FF]/5' : ''}`}
                  >
                    <div className="w-24 flex-shrink-0"><StatusBadge status={w.status} /></div>
                    <div className="flex-1 min-w-[10rem]">
                      <p className="text-base font-semibold text-gray-900 truncate">
                        {w.name}
                        {w.id === justCreatedId && (
                          <span className="ml-2 align-middle text-xs font-semibold text-[#4a40d4] bg-[#6C60FF]/10 rounded-full px-2 py-0.5">New</span>
                        )}
                      </p>
                      <InstallStatusLine widget={w} />
                    </div>
                    <div className="text-sm text-gray-600 w-24 flex-shrink-0">
                      {w.leads_count ?? 0} {w.leads_count === 1 ? 'lead' : 'leads'}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openBuilder(w)}
                        aria-label={`Edit ${w.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openInstall(w)}
                        aria-label={`Install ${w.name} on your website`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90"
                        style={{ background: BRAND }}
                      >
                        <Code2 className="w-4 h-4" /> Install
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
