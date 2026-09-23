import type { Lead } from '../services/leadsAPI';

// Formatting for the inbox-style Leads list (spec 2026-09-23 §5), modelled on
// Chris's reference: "Mon, Sep 21, 2026 4:49 PM", one-line excerpt with a
// "✓ Sam" prefix on messages we sent.

export function formatInboxDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} ${time}`;
}

export function inboxExcerpt(lead: Lead): { prefix: string | null; text: string } {
  const m = lead.latest_message;
  if (!m) return { prefix: null, text: '—' };
  const prefix = m.direction === 'outbound' ? `✓ ${m.sender_name || 'You'}` : null;
  const text = m.body?.trim() ? m.body.trim() : m.attachment_name ? `File: ${m.attachment_name}` : '—';
  return { prefix, text };
}

// Phone in (647) 913-1301 form when it's a North American number; else as stored.
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  return raw;
}

export function leadContactLine(lead: Lead): string {
  return formatPhone(lead.user?.phone_number) || lead.user?.email || '—';
}

export function isUnread(lead: Lead): boolean {
  return (lead.unread_count ?? 0) + (lead.comment_unread_count ?? 0) > 0;
}

// Initials for an avatar fallback ("Brian Felicio" → "BF").
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
