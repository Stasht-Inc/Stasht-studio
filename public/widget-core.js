// public/widget-core.js
// Pure helpers for the embed page. No DOM, no network — unit-tested with `npm run test:widget`.

export const MESSAGE_MAX = 320;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Stasht purple, as in Chris's ContactWidget design, when a widget has no brand colour set.
export const DEFAULT_BRAND = '#6C60FF';

export function safeColor(value, fallback = DEFAULT_BRAND) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

export function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Black or white text, whichever reads better on the given hex background. */
export function contrastInk(hex) {
  const h = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/** Best guess at the customer's page origin, sent to the API as host_origin. */
export function hostOrigin({ hostParam, referrer }) {
  for (const candidate of [hostParam, referrer]) {
    try {
      if (candidate) return new URL(candidate).origin;
    } catch {
      // try the next candidate
    }
  }
  return '';
}

/** Config URL for the embed page. `host` (the customer page origin) lets the server show owners where the widget is installed. */
export function configUrl(api, widgetId, host) {
  const base = `${api}/widget-embed/${encodeURIComponent(widgetId)}/config`;
  return host ? `${base}?host=${encodeURIComponent(host)}` : base;
}

/** Same rule as the server's PhoneCanonicalizer::toE164 — early feedback only, the server is authoritative. */
export function isPlausiblePhone(raw) {
  const value = String(raw || '').trim();
  const digits = value.replace(/\D+/g, '');
  if (value.startsWith('+')) return digits.length >= 8 && digits.length <= 15;
  if (digits.length === 10) return true;
  return digits.length === 11 && digits[0] === '1';
}

export function clampPosition(value) {
  return value === 'bottom-left' ? 'bottom-left' : 'bottom-right';
}

/**
 * Transparent space around the launcher/panel inside the iframe, so their shadows fade out before
 * the iframe edge instead of being cut into a hard grey box. Bottom is largest: shadows fall down.
 */
export const ROOT_PAD = { top: 12, x: 16, bottom: 24 };

const PANEL_MAX_W = 420; // Chris, 2026-09-28: "make chatbox and text slightly bigger" (was 380)

/** Panel width that fits the host page's viewport (passed in by the loader as ?vw=). */
export function panelWidth(viewportWidth) {
  const vw = Number(viewportWidth);
  if (!Number.isFinite(vw) || vw <= 0) return PANEL_MAX_W;
  // The loader caps the iframe at vw - 32; the panel plus its side padding has to fit in that.
  return Math.max(240, Math.min(PANEL_MAX_W, Math.floor(vw) - 32 - ROOT_PAD.x * 2));
}

/** Max panel height so the panel scrolls inside the iframe instead of being clipped on short host viewports. */
export function panelMaxHeight(viewportHeight) {
  const vh = Number(viewportHeight);
  const cap = !Number.isFinite(vh) || vh <= 0 ? 720 : Math.min(720, Math.floor(vh) - 32);
  // The loader caps the iframe at min(720, vh - 32); #root adds the top and bottom padding.
  return Math.max(200, cap - ROOT_PAD.top - ROOT_PAD.bottom);
}

// --- Form fields -----------------------------------------------------------------------------
// The server sends the shown fields (in order) as config.form_fields; see WidgetFormFields.php.

const FIELD_KEYS = ['name', 'mobile', 'email', 'company', 'message'];
const DEFAULT_LABELS = { name: 'Name', mobile: 'Mobile Number', email: 'Email', company: 'Company Name', message: 'Message' };

/** The original form, used when the API predates configurable fields. */
export const DEFAULT_FORM_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'mobile', label: 'Mobile Number', required: true },
  { key: 'company', label: 'Company Name', required: false },
  { key: 'message', label: 'Message', required: true },
];

export function formFieldsFrom(config) {
  const list = Array.isArray(config?.form_fields)
    ? config.form_fields.filter((f) => f && FIELD_KEYS.includes(f.key))
    : [];
  if (!list.length) return DEFAULT_FORM_FIELDS;
  return list.map((f) => ({ key: f.key, label: String(f.label || DEFAULT_LABELS[f.key]), required: Boolean(f.required) }));
}

export function fieldLabel(field) {
  return field.required ? field.label : `${field.label} (optional)`;
}

/** Early feedback only; the server's `email` rule decides. */
export function isPlausibleEmail(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || '').trim());
}

const REQUIRED_MESSAGES = {
  name: 'Enter your name.',
  mobile: 'Enter a valid phone number, including the area code.',
  email: 'Enter your email address.',
  company: 'Enter your company name.',
  message: 'Enter a message.',
};

/** Errors keyed by field for the shown fields only. */
export function validateValues(fields, values) {
  const errors = {};
  for (const field of fields) {
    const value = String(values[field.key] || '').trim();
    if (!value) {
      if (field.required) errors[field.key] = REQUIRED_MESSAGES[field.key];
    } else if (field.key === 'mobile' && !isPlausiblePhone(value)) {
      errors.mobile = 'Enter a valid phone number, including the area code.';
    } else if (field.key === 'email' && !isPlausibleEmail(value)) {
      errors.email = 'Enter a valid email address.';
    }
  }
  return errors;
}

// Copy from Chris's ContactWidget design.
export const DEFAULT_CALLOUT = 'Hi there! Have a question?';
export const CALLOUT_SUBTEXT = 'Chat with us here.';
export const DEFAULT_WELCOME = 'Enter your question below and a representative will get right back to you.';
const MESSAGE_PLACEHOLDER = 'I want to know more...';

export function consentText() {
  return 'By submitting you agree to receive messages for the provided channel. Rates may be applied.';
}

/** Inputs carry their label as the placeholder ("Name *", "Business (optional)"), as in the design. */
export function placeholderFor(field) {
  if (field.key === 'message' && field.label === DEFAULT_LABELS.message) return MESSAGE_PLACEHOLDER;
  return field.required ? `${field.label} *` : `${field.label} (optional)`;
}

/** The instant reply shown under the visitor's message once it's sent. */
export function autoReplyText(name) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return `Hi${first ? ` ${first}` : ''}! Thanks for reaching out. We've got your message and will reply shortly.`;
}

/** "Christian Beckermann" -> "CB". */
export function initialsFrom(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/**
 * A team member as the server shows them on customers' websites (WidgetTeam::publicPerson):
 * first name, an https photo, up to two initials and a colour. Null when there's no name.
 */
export function publicPersonFrom(m) {
  if (!m || typeof m.name !== 'string' || m.name.trim() === '') return null;
  const name = m.name.trim();
  return {
    name,
    avatarUrl: safeHttpsUrl(m.avatar_url),
    initials: String(m.initials || name[0] || '?').slice(0, 2).toUpperCase(),
    color: safeColor(m.color, '#6C60FF'),
  };
}

// Who's online (config.team_online): up to four team members, first name + an
// https photo or initials on a colour. Anything unexpected is dropped or defaulted.
export function teamOnlineFrom(config) {
  const list = Array.isArray(config?.team_online) ? config.team_online : [];
  return list.map(publicPersonFrom).filter(Boolean).slice(0, 4);
}

/** "4 online". */
export function onlineCountText(team) {
  return `${(team || []).length} online`;
}

/** White initials on avatar colours, as in the design; dark only on very pale colours. */
export function initialsInk(hex) {
  const h = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8 ? '#1f2937' : '#ffffff';
}

// --- Live chat (spec 2026-09-29, part 1) -----------------------------------------------------
// The server's limits (WidgetChatMessages / WidgetChatAttachments), checked here for early
// feedback only. The server is authoritative.

export const CHAT_MESSAGE_MAX = 1000;
export const CHAT_MAX_FILES = 3;
export const CHAT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CHAT_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
export const CHAT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const POLL_OPEN_MS = 3000;
export const POLL_CLOSED_MS = 15000;
export const POLL_CLOSED_WINDOW_MS = 60 * 60 * 1000;
const POLL_MAX_BACKOFF_MS = 60000;

/** Where the embed remembers the conversation, per widget (the iframe's own localStorage). */
export function chatStorageKey(widgetId) {
  return `stasht-widget-chat:${widgetId}`;
}

/** The saved {token, updatedAt}, or null when missing, malformed or 30+ days old (then it's removed). */
export function readChatToken(storage, widgetId, now = Date.now()) {
  let raw = null;
  try {
    raw = storage.getItem(chatStorageKey(widgetId));
  } catch {
    return null;
  }
  if (raw === null || raw === undefined) return null;
  let saved = null;
  try {
    saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  const ok = saved && typeof saved.token === 'string' && saved.token !== '' && saved.token.length <= 64
    && Number.isFinite(saved.updatedAt) && now - saved.updatedAt < CHAT_TOKEN_TTL_MS;
  if (ok) return { token: saved.token, updatedAt: saved.updatedAt };
  clearChatToken(storage, widgetId);
  return null;
}

/** Saves the token with `now` as updatedAt (also "when the visitor last looked"). False when storage is blocked. */
export function writeChatToken(storage, widgetId, token, now = Date.now()) {
  try {
    storage.setItem(chatStorageKey(widgetId), JSON.stringify({ token, updatedAt: now }));
    return true;
  } catch {
    return false;
  }
}

export function clearChatToken(storage, widgetId) {
  try {
    storage.removeItem(chatStorageKey(widgetId));
  } catch {
    // storage blocked: nothing was saved
  }
}

/** GET (history; `after` pages it) and POST (send) URL for the chat. */
export function messagesUrl(api, widgetId, afterId = 0) {
  const base = `${api}/widgets/${encodeURIComponent(widgetId)}/messages`;
  return afterId > 0 ? `${base}?after=${afterId}` : base;
}

/**
 * The X-Widget-Chat-Open header value: '1' while the panel is open, '0' while closed. Lets the
 * server tell a GET made with the panel actually visible (part 2 marks outbound messages seen
 * only then) apart from background polling while closed. A POST always means the visitor is
 * typing in the panel, so callers building POST headers should pass `true` regardless of
 * `state.open`, but this helper only turns a boolean into the header's string value.
 */
export function chatOpenHeaderValue(open) {
  return open ? '1' : '0';
}

/**
 * A message from the API in a safe, render-ready shape, or null when it can't be shown.
 * Only https attachment links survive; senders only on team messages.
 */
export function chatMessageFrom(raw) {
  if (!raw || !Number.isInteger(raw.id) || raw.id <= 0) return null;
  if (raw.from !== 'visitor' && raw.from !== 'team') return null;
  const attachments = (Array.isArray(raw.attachments) ? raw.attachments : [])
    .map((a) => ({
      url: safeHttpsUrl(a?.url),
      filename: String(a?.filename || 'file'),
      isImage: /^image\//i.test(String(a?.content_type || '')),
    }))
    .filter((a) => a.url);
  const body = typeof raw.body === 'string' ? raw.body : '';
  if (body.trim() === '' && attachments.length === 0) return null;
  const sentAt = raw.sent_at ? new Date(raw.sent_at) : null;
  const fromTeam = raw.from === 'team';
  const isAi = fromTeam && raw.is_ai === true;
  return {
    id: raw.id,
    from: raw.from,
    body,
    sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
    attachments,
    sender: fromTeam ? publicPersonFrom(raw.sender) : null,
    // Widget AI (spec part 2 §3): an AI reply, its fallback notice, and the vehicles it shared.
    isAi,
    autoReply: isAi && raw.auto_reply === true,
    campaign: fromTeam ? campaignFrom(raw.campaign) : null,
  };
}

/** Messages by id, oldest first, one copy each (a later copy of an id replaces the earlier one). */
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) if (m) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function lastMessageId(messages) {
  return messages.reduce((max, m) => Math.max(max, m.id), 0);
}

/**
 * Which picked files may join the queue: at most 3 per message, JPG/PNG/GIF/WebP/PDF, 5 MB each.
 * Returns the accepted files and the first problem to show under the typing box (or null).
 */
export function acceptChatFiles(queuedCount, picked) {
  const accepted = [];
  let error = null;
  for (const file of picked) {
    if (!CHAT_FILE_TYPES.includes(String(file.type || '').toLowerCase())) {
      error = error || 'You can attach JPG, PNG, GIF or WebP photos and PDF files.';
    } else if (file.size > CHAT_MAX_FILE_BYTES) {
      error = error || `${file.name} is over 5 MB.`;
    } else if (queuedCount + accepted.length >= CHAT_MAX_FILES) {
      error = error || 'You can attach up to 3 files per message.';
    } else {
      accepted.push(file);
    }
  }
  return { accepted, error };
}

/** Why the message can't be sent yet, or null. Characters are counted like the server (not UTF-16 units). */
export function chatSendProblem(text, fileCount) {
  const body = String(text || '').trim();
  if (body === '' && !fileCount) return 'Type a message or attach a file.';
  if ([...body].length > CHAT_MESSAGE_MAX) return 'Messages can be up to 1,000 characters.';
  return null;
}

/**
 * When to check for replies next (spec §2): every 3 s while the panel is open; every 15 s while it's
 * closed, for up to 60 min after the last message; then null (stop until the visitor opens it).
 */
export function nextPollDelay({ open, lastActivityAt, now = Date.now() }) {
  if (open) return POLL_OPEN_MS;
  return now - lastActivityAt < POLL_CLOSED_WINDOW_MS ? POLL_CLOSED_MS : null;
}

/** After failed checks (429, server errors, offline), wait twice as long each time, up to a minute. */
export function backoffDelay(baseMs, failures) {
  if (!failures) return baseMs;
  return Math.min(POLL_MAX_BACKOFF_MS, baseMs * 2 ** Math.min(failures, 6));
}

/** A team message newer than when the visitor last looked (the launcher's unread dot on return). */
export function hasUnreadTeamMessage(messages, seenAt) {
  return messages.some((m) => m.from === 'team' && m.sentAt instanceof Date && m.sentAt.getTime() > seenAt);
}

/**
 * The embed's automatic reply isn't stored, so it's drawn after a message: the one just sent from
 * the form, else the conversation's first message when the visitor sent it (a returning visitor).
 * With the AI on, the server answers at once instead (an AI reply or its fallback notice): then there
 * is none — `off` when /submit returned replies, and whenever the next message is the AI's, so a
 * reloaded history looks the same.
 */
export function autoReplyAnchor(messages, submittedId = null, off = false) {
  if (off) return null;
  let anchor = null;
  if (submittedId && messages.some((m) => m.id === submittedId)) anchor = submittedId;
  else if (messages[0] && messages[0].from === 'visitor') anchor = messages[0].id;
  if (anchor === null) return null;
  const next = messages[messages.findIndex((m) => m.id === anchor) + 1];
  return next && next.from === 'team' && next.isAi ? null : anchor;
}

/** The first validation message from a 422 body (Laravel's {errors: {field: [msg]}}), else the fallback. */
export function firstServerError(body, fallback) {
  const errors = body && typeof body.errors === 'object' && body.errors ? body.errors : {};
  for (const messages of Object.values(errors)) {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (typeof first === 'string' && first.trim() !== '') return first;
  }
  return fallback;
}

// --- Widget AI (spec 2026-09-29 part 2 §3; always on since 2026-10-03) --------------------------

/** "typing…" shows (and the form's message becomes the chat) once a send has taken this long. */
export const TYPING_DELAY_MS = 600;

/** An AI reply more than 12 h after the previous one starts a new run, with the notice again. */
export const AI_RUN_GAP_MS = 12 * 60 * 60 * 1000;

export const AI_NOTICE = "You're chatting with our AI assistant. A team member can join at any time.";

// "Powered by Stasht" at the foot of the open panel (Chris, 2026-10-02: brand awareness). The link is
// tagged so stasht.com can count visits from widgets.
export const POWERED_BY_URL = 'https://stasht.com/?utm_source=contact-widget&utm_medium=referral&utm_campaign=powered-by';
export const STASHT_MARK_VIEWBOX = '0 0 78.99 52.48';
export const STASHT_MARK_PATH = 'M75.57,52.48h3.42c-5.63-1.56-12.32-2.8-19.72-3.6.58-1.96.88-4.15.88-6.55,0-3.19-.46-5.9-1.37-8.12-.91-2.23-2.34-4.16-4.28-5.81-1.94-1.65-4.89-3.33-8.83-5.05-5.31-2.21-8.52-3.67-9.63-4.39-1.11-.72-1.67-1.58-1.67-2.6,0-1.65,1.59-2.47,4.78-2.47,1.82,0,4.18.43,7.07,1.29,2.89.86,5.62,1.9,8.21,3.13l5.27-13.25c-3.52-1.65-6.91-2.9-10.17-3.76-3.27-.86-6.76-1.29-10.47-1.29-7.4,0-13.12,1.54-17.17,4.63-4.05,3.08-6.07,7.4-6.07,12.94,0,4.38,1.03,8,3.09,10.86,2.06,2.86,5.67,5.41,10.85,7.65,5.67,2.38,9.1,3.99,10.27,4.81,1.18.82,1.77,1.76,1.77,2.81,0,2.04-2.11,3.05-6.32,3.05-2.82,0-6.03-.45-9.63-1.37-3.6-.91-6.91-2.07-9.93-3.47v7.43c-5.9.78-11.27,1.85-15.91,3.14h1.99c10.72-1.33,23.32-2.1,36.79-2.1s26.06.77,36.79,2.1Z';

/** The AI's campaign link card, or null: an https link and a title (vehicles 0 when unknown). */
export function campaignFrom(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = safeHttpsUrl(raw.url);
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!url || !title) return null;
  const vehicles = Number.isInteger(raw.vehicles) && raw.vehicles > 0 ? raw.vehicles : 0;
  return { title, url, linkText: String(raw.url).trim(), vehicles };
}

/** "View 6 vehicles" / "View 1 vehicle" (no count: "View vehicles"). */
export function campaignCardText(vehicles) {
  if (!vehicles) return 'View vehicles';
  return `View ${vehicles} ${vehicles === 1 ? 'vehicle' : 'vehicles'}`;
}

/** The reply's text without the campaign link: the card under it carries the link. */
export function bodyWithoutLink(body, linkText) {
  const text = String(body || '');
  if (!linkText) return text;
  return text.split(linkText).join('').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

/**
 * Where the AI notice goes (spec part 2 §3): before the first AI reply of each run, i.e. an AI reply
 * whose previous team message wasn't an AI reply from the last 12 h. The fallback notice isn't an
 * AI reply, so an AI reply after it starts a new run. Unknown times count as the same run.
 */
export function aiNoticeBefore(messages) {
  const ids = new Set();
  let lastTeam = null;
  for (const m of messages) {
    if (m.from !== 'team') continue;
    if (m.isAi && !m.autoReply) {
      const gap = m.sentAt instanceof Date && lastTeam?.sentAt instanceof Date ? m.sentAt - lastTeam.sentAt : 0;
      const continues = lastTeam && lastTeam.isAi && !lastTeam.autoReply && gap <= AI_RUN_GAP_MS;
      if (!continues) ids.add(m.id);
    }
    lastTeam = m;
  }
  return ids;
}

/** The line drawn when a team member takes over from the AI (Chris, 2026-10-03). */
export function joinedText(name) {
  return `${String(name || '').trim() || 'A team member'} has joined the conversation`;
}

/**
 * Before which team messages "{name} has joined the conversation" goes: a message from a person (not
 * the AI, with a sender) that takes over from the AI — the first person message after any AI message
 * (a reply or its fallback notice), or the first after 12 h+ since the previous person message in a
 * conversation the AI has touched (the AI is back in charge by then). Never in conversations the AI
 * never touched. Unknown times count as no gap.
 */
export function repJoinedBefore(messages) {
  const ids = new Set();
  let aiEver = false;
  let aiSinceRep = false;
  let lastRep = null;
  for (const m of messages) {
    if (m.from !== 'team') continue;
    if (m.isAi) {
      aiEver = true;
      aiSinceRep = true;
      continue;
    }
    if (!m.sender) continue;
    const gap = m.sentAt instanceof Date && lastRep?.sentAt instanceof Date ? m.sentAt - lastRep.sentAt : 0;
    if (aiSinceRep || (aiEver && lastRep && gap >= AI_RUN_GAP_MS)) ids.add(m.id);
    aiSinceRep = false;
    lastRep = m;
  }
  return ids;
}

// --- Links in chat bubbles (ClickUp wdy2xh1tdp) ---------------------------------------------------
// The AI gives the business's own page links ("our hours are at https://…/hours"), so every bubble
// makes https:// URLs clickable. Split here as plain data; the embed builds text nodes and <a>s.

// ONE strict ASCII URL grammar, character for character the same as WidgetAiLinks::URL_GRAMMAR on the
// server (and components/leads/LinkifiedText.tsx), so the server's link guard and the browser always
// read the same URL: it ends at whitespace, quotes, <, >, `, a backslash or anything non-ASCII, and
// its authority is only letters, digits, dots and hyphens (plus a port).
export const URL_GRAMMAR = 'https?://([A-Za-z0-9.\\-]+)(?::[0-9]+)?(?:[/?#][!#-&(-;=?-\\[\\]-_a-z~%]*)?';
// Sentence punctuation after a URL that isn't part of it (same set as WidgetAiLinks::TRAILING).
const URL_TRAILING = /[.,;:!?)]+$/;

/**
 * Text split into plain parts and https links: [{ text }, { text, href }, …]. A link's text is the
 * URL without "https://"; its href is the full URL. Only https: URLs become links, and never one
 * whose authority runs into "\" or "@" or that the browser would read as another host.
 */
export function linkParts(body) {
  const text = String(body ?? '');
  const parts = [];
  const re = new RegExp(URL_GRAMMAR, 'gi');
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    const after = text[match.index + match[0].length];
    if (after === '\\' || after === '@') {
      // Browsers would read another host here: the whole run stays plain text.
      const run = /^\S*/.exec(text.slice(match.index))[0];
      re.lastIndex = match.index + Math.max(run.length, 1);
      continue;
    }
    const raw = match[0].replace(URL_TRAILING, '');
    const href = linkHref(raw, match[1]);
    if (!href) continue;
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: raw.replace(/^https:\/\//i, ''), href });
    last = match.index + raw.length;
  }
  if (last < text.length || parts.length === 0) parts.push({ text: text.slice(last) });
  return parts;
}

/** The https URL to link, or null when it isn't https or the browser reads a different host than the text shows. */
function linkHref(raw, literalHost) {
  if (raw.includes('\\') || !/^https:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== String(literalHost).toLowerCase()) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Lowercase hostname without a leading www. (www.site.com and site.com are one site), or ''. */
export function siteHost(urlOrOrigin) {
  try {
    const host = new URL(String(urlOrOrigin)).hostname.toLowerCase().replace(/\.$/, '');
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return '';
  }
}

/**
 * How a chat link opens. A page on the site the widget is running on replaces that page (target
 * _top: the visitor's site navigates and the chat carries on there); anything else opens a new tab.
 */
export function linkTarget(href, hostPageOrigin) {
  const host = siteHost(href);
  if (host && host === siteHost(hostPageOrigin)) return { target: '_top' };
  return { target: '_blank', rel: 'noopener noreferrer' };
}

/** How long after following a same-site chat link the next page reopens the chat panel. */
export const REOPEN_AFTER_LINK_MS = 60 * 1000;

/** Whether the panel should open by itself: a same-site chat link was followed a moment ago (stored ms). */
export function shouldReopenChat(stored, now = Date.now()) {
  const at = Number(stored);
  return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at <= REOPEN_AFTER_LINK_MS;
}

// --- Click-through around the widget (wdy2xh1tjc) -------------------------------------------
// The iframe is a rectangle, but most of it is transparent: the shadow padding, and when closed
// the empty space beside the launcher under the callout. An iframe takes every click inside its
// rectangle, so the host page's links there went dead. The embed reports the parts that are
// actually visible ("hit rects", in iframe coordinates) and the loader clips the iframe to them
// with clip-path, which also takes the clipped-out area out of hit-testing.
//
// sanitizeHitRects and hitClipPath are copied verbatim into widget-loader.js (a classic script on
// the customer's page, so it can't import this module); the tests check the two copies match.

/** Room kept around each visible part so rounded corners and the near shadow aren't cut. Bottom is largest: shadows fall down. */
export const HIT_PAD = { top: 6, x: 8, bottom: 16 };
export const HIT_RECTS_MAX = 6;

/** One visible part's hit rect from its bounding box (iframe coordinates) and corner radius. */
export function hitRectFor(box, radius = 0, pad = HIT_PAD) {
  const x = Math.floor(box.left - pad.x);
  const y = Math.floor(box.top - pad.top);
  const right = Math.ceil(box.left + box.width + pad.x);
  const bottom = Math.ceil(box.top + box.height + pad.bottom);
  return { x, y, w: right - x, h: bottom - y, r: Math.max(0, Math.round(radius + Math.min(pad.x, pad.top))) };
}

/**
 * The embed's hit rects, checked before they shape the iframe on the customer's page: an array of
 * 1..6 { x, y, w, h, r? } plain numbers, clamped to the frame. Anything unexpected returns null,
 * which means "no clip" (the whole iframe stays clickable, as before this fix).
 */
export function sanitizeHitRects(raw, frameW, frameH) {
  var MAX = 6;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX) return null;
  var W = frameW, H = frameH;
  if (typeof W !== 'number' || typeof H !== 'number' || !(W > 0) || !(H > 0) || !isFinite(W) || !isFinite(H)) return null;
  var num = function (n) { return typeof n === 'number' && isFinite(n); };
  var clamp = function (n, max) { return Math.max(0, Math.min(max, n)); };
  var round = function (n) { return Math.round(n * 100) / 100; };
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i];
    if (!r || typeof r !== 'object') return null;
    var rad = r.r === undefined ? 0 : r.r;
    if (!num(r.x) || !num(r.y) || !num(r.w) || !num(r.h) || !num(rad) || r.w < 0 || r.h < 0) return null;
    var x0 = clamp(r.x, W), y0 = clamp(r.y, H), x1 = clamp(r.x + r.w, W), y1 = clamp(r.y + r.h, H);
    if (x1 - x0 < 1 || y1 - y0 < 1) continue; // nothing of it inside the frame
    out.push({
      x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0),
      r: round(Math.max(0, Math.min(rad, (x1 - x0) / 2, (y1 - y0) / 2))),
    });
  }
  return out.length ? out : null;
}

/** CSS clip-path for sanitized hit rects: one clockwise (rounded) rectangle subpath each, so they add up. */
export function hitClipPath(rects) {
  var f = function (n) { return String(Math.round(n * 100) / 100); };
  var d = [];
  for (var i = 0; i < rects.length; i++) {
    var x = rects[i].x, y = rects[i].y, w = rects[i].w, h = rects[i].h, r = rects[i].r || 0;
    if (r > 0) {
      var a = 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ';
      d.push('M' + f(x + r) + ' ' + f(y) + 'H' + f(x + w - r) + a + f(x + w) + ' ' + f(y + r)
        + 'V' + f(y + h - r) + a + f(x + w - r) + ' ' + f(y + h)
        + 'H' + f(x + r) + a + f(x) + ' ' + f(y + h - r)
        + 'V' + f(y + r) + a + f(x + r) + ' ' + f(y) + 'Z');
    } else {
      d.push('M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'V' + f(y + h) + 'H' + f(x) + 'Z');
    }
  }
  return "path('" + d.join(' ') + "')";
}

// --- Where the widget shows ------------------------------------------------------------------
// Chris, 2026-10-06: a customer's site template is also used by their admin pages, so the widget
// showed inside their admin; "it should be for front end only".
//
// 1. Admin pages are always skipped. The loader checks this before it injects anything (no frame,
//    no request). ADMIN_PATH_SEGMENTS and isAdminPath are copied verbatim into widget-loader.js
//    between <admin-skip> markers (tests/widget/widget-paths.test.mjs checks they match), so they
//    stay ES5 and DOM-free.
// <admin-skip>
var ADMIN_PATH_SEGMENTS = ['admin', 'wp-admin', 'administrator', 'wp-login.php'];

function isAdminPath(pathname) {
  if (typeof pathname !== 'string') return false;
  var first = pathname.split('/')[1] || '';
  try { first = decodeURIComponent(first); } catch (e) { /* malformed escape: compare as is */ }
  return ADMIN_PATH_SEGMENTS.indexOf(first.toLowerCase()) !== -1;
}
// </admin-skip>
export { ADMIN_PATH_SEGMENTS, isAdminPath };

// 2. Each widget's "Don't show on these pages" list (config.hidden_paths): "/checkout",
//    "/account/*". Rules match the server's WidgetHiddenPaths and the builder's hiddenPathsProblem.
export const HIDDEN_PATHS_MAX = 20;
export const HIDDEN_PATH_LENGTH_MAX = 200;

const withoutTrailingSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, '') || '/' : p);
const escapeRegex = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** A pattern as a whole-path, case-insensitive regex; null for an entry that can't be a page address. */
function hiddenPathRegex(raw) {
  if (typeof raw !== 'string') return null;
  const pattern = withoutTrailingSlash(raw.trim());
  if (!pattern.startsWith('/') || pattern.length > HIDDEN_PATH_LENGTH_MAX) return null;
  // "/account/*" also covers "/account" itself: hiding a section should hide its front page too.
  if (pattern.length > 2 && pattern.endsWith('/*')) {
    return new RegExp('^' + pattern.slice(0, -2).split('*').map(escapeRegex).join('.*') + '(?:/.*)?$', 'i');
  }
  // Elsewhere * matches any characters, "/" included.
  return new RegExp('^' + pattern.split('*').map(escapeRegex).join('.*') + '$', 'i');
}

/**
 * True when the host page's path (location.pathname, passed by the loader as ?path=) matches one of
 * the widget's hidden_paths. Whole path, case-insensitive, a trailing slash ignored; the path is also
 * tried percent-decoded ("/caf%C3%A9" matches "/café"). No path (an older cached loader) never hides.
 */
export function pathHidden(path, patterns) {
  if (typeof path !== 'string' || !path.startsWith('/') || !Array.isArray(patterns)) return false;
  const candidates = [withoutTrailingSlash(path)];
  try {
    const decoded = withoutTrailingSlash(decodeURIComponent(path));
    if (decoded !== candidates[0]) candidates.push(decoded);
  } catch { /* malformed escape: raw path only */ }
  return patterns.some((raw) => {
    const re = hiddenPathRegex(raw);
    return !!re && candidates.some((c) => re.test(c));
  });
}
