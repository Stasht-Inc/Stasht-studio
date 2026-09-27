import { apiRequest } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';

// Contact Us widget management API (authenticated, /api/react/widgets).
// The public embed endpoints (/widget-embed/*, /widgets/{id}/submit) are called by
// public/widget-embed.js directly and are intentionally not wrapped here.

export type WidgetStatus = 'draft' | 'live' | 'paused';
export type WidgetBubblePosition = 'bottom-left' | 'bottom-right';

export interface WidgetTheme {
  primary_color: string | null;
  logo_url: string | null;
  bubble_position: WidgetBubblePosition;
}

// Built-in form fields (see WidgetFormFields.php). Mobile or Email must be shown + required.
export type FormFieldKey = 'name' | 'mobile' | 'email' | 'company' | 'message';
export interface FormFieldSetting {
  show: boolean;
  required: boolean;
  label: string;
}
export type FormFieldSettings = Record<FormFieldKey, FormFieldSetting>;

// A website the widget has been loaded on, as reported by the embed page (most recent first).
export interface WidgetInstall {
  host: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface ContactWidget {
  id: string; // 'w_' + 10 chars, used directly in the embed snippet
  name: string;
  status: WidgetStatus;
  agent_name: string | null;
  callout_text: string | null;
  welcome_subtext: string | null;
  theme: WidgetTheme;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
  leads_count: number;
  installs?: WidgetInstall[]; // absent from older API builds
  form_fields?: FormFieldSettings; // absent from older API builds -> the original form
  // The dealership whose team takes over this widget's leads; null = the owner alone.
  property_id?: number | null;
}

// A dealership a widget's leads can go to (GET /widgets team_options).
export interface WidgetTeamOption {
  id: number;
  name: string;
}

// Fields editable in this phase. Every field is optional so PATCH can send a partial body.
export interface ContactWidgetInput {
  name?: string;
  status?: WidgetStatus;
  agent_name?: string | null;
  callout_text?: string | null;
  welcome_subtext?: string | null;
  theme?: Partial<WidgetTheme>;
  allowed_domains?: string[];
  form_fields?: Partial<Record<FormFieldKey, Partial<FormFieldSetting>>>;
  property_id?: number | null;
}

// Server bodies are {success, data}. apiRequest wraps a successful body as
// {success: true, data: <body>}, so the payload is one `.data` deeper than the
// contract reads; unwrap defensively so either shape works.
function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T | undefined;
}

export interface WidgetResult<T> {
  ok: boolean;
  data?: T;
  // Human-readable summary for a toast.
  error?: string;
  // Laravel 422 errors flattened to one message per field ('theme.primary_color' style keys kept;
  // 'allowed_domains.N' folded into 'allowed_domains').
  fieldErrors: Record<string, string>;
}

function flattenFieldErrors(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== 'object') return out;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const message = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (!message) continue;
    const field = key.replace(/\.\d+$/, '');
    if (!out[field]) out[field] = message;
  }
  return out;
}

async function run<T>(request: Promise<ApiResponse<any>>): Promise<WidgetResult<T>> {
  try {
    const res = await request;
    if (!res.success) {
      return {
        ok: false,
        error: res.error || res.message || 'Request failed. Please try again.',
        fieldErrors: flattenFieldErrors(res.errors),
      };
    }
    return { ok: true, data: unwrap<T>(res.data), fieldErrors: {} };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
  }
}

export const widgetsAPI = {
  // A list must never be stale right after create/delete, so it bypasses apiRequest's short
  // GET cache (writes also clear that cache).
  list: () => run<ContactWidget[]>(apiRequest('/widgets', { method: 'GET', skipCache: true } as RequestInit)),

  // The list plus the dealerships a widget can route leads to (the builder's Team picker).
  listWithTeams: async (): Promise<WidgetResult<{ widgets: ContactWidget[]; teamOptions: WidgetTeamOption[] }>> => {
    try {
      const res = await apiRequest<any>('/widgets', { method: 'GET', skipCache: true } as RequestInit);
      if (!res.success) {
        return { ok: false, error: res.error || res.message || 'Request failed. Please try again.', fieldErrors: {} };
      }
      const body: any = res.data;
      const widgets = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const teamOptions = Array.isArray(body?.team_options) ? body.team_options : [];
      return { ok: true, data: { widgets, teamOptions }, fieldErrors: {} };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
    }
  },

  get: (id: string) =>
    run<ContactWidget>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'GET', skipCache: true } as RequestInit)),

  create: (input: ContactWidgetInput) =>
    run<ContactWidget>(apiRequest('/widgets', { method: 'POST', body: JSON.stringify(input) })),

  update: (id: string, input: ContactWidgetInput) =>
    run<ContactWidget>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })),

  remove: (id: string) =>
    run<unknown>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'DELETE' })),
};
