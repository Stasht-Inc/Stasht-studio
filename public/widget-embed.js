// public/widget-embed.js
// Layout follows Chris's ContactWidget frames: a callout card with who's online above a round
// launcher; an open panel with the agent header, an intro bubble and the form. After sending, the
// panel becomes a live chat with the team (spec 2026-09-29): the whole conversation, a typing box
// with a paperclip, replies picked up by polling, an unread dot on the closed launcher, and
// returning visitors (same browser, 30 days) straight back into their chat instead of the form.
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, clampPosition, panelWidth, panelMaxHeight, MESSAGE_MAX,
  configUrl, ROOT_PAD, formFieldsFrom, validateValues, consentText, placeholderFor, autoReplyText, initialsFrom,
  teamOnlineFrom, onlineCountText, initialsInk, DEFAULT_CALLOUT, CALLOUT_SUBTEXT, DEFAULT_WELCOME,
  CHAT_MESSAGE_MAX, CHAT_FILE_TYPES, readChatToken, writeChatToken, clearChatToken, messagesUrl, chatMessageFrom,
  mergeMessages, lastMessageId, acceptChatFiles, chatSendProblem, nextPollDelay, backoffDelay, hasUnreadTeamMessage,
  autoReplyAnchor, firstServerError,
} from './widget-core.js';

const params = new URLSearchParams(location.search);
const widgetId = params.get('w') || '';
const API = `${location.origin}/api/react`;
const root = document.getElementById('root');
root.style.padding = `${ROOT_PAD.top}px ${ROOT_PAD.x}px ${ROOT_PAD.bottom}px`;

const DISMISS_KEY = `stasht-widget-callout-dismissed:${widgetId}`;

// The conversation token lives in this iframe's own localStorage (Studio's origin, never the
// customer's site). Browsers that block storage in iframes still get the chat for this page view;
// it just isn't remembered.
const chatStore = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})() || { getItem: () => null, setItem() {}, removeItem() {} };

const state = {
  config: null,
  open: false,
  phase: 'form', // 'form' | 'chat'
  sending: false,
  errors: {},
  values: { name: '', mobile: '', email: '', company: '', message: '' },
  calloutDismissed: readDismissed(),
  // Live chat
  token: null,
  messages: [], // chatMessageFrom() shapes, oldest first
  submittedId: null, // the form message sent in this page view: the automatic reply follows it
  visitorName: '',
  draft: '',
  files: [], // [{ file, previewUrl }]
  chatError: '',
  chatSending: false,
  unread: false,
  lastActivity: 0, // ms of the last message either way; closed-panel checks stop an hour after it
};

// The shown fields, in order (set once the config loads).
const fields = () => formFieldsFrom(state.config);

function readDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

function tell(type, extra = {}) {
  window.parent.postMessage({ source: 'stasht-widget', id: widgetId, type, ...extra }, '*');
}

// Tiny DOM builder. Everything is created with textContent/attributes — never innerHTML —
// so widget-owner-supplied copy (and chat messages) can never inject markup into a visitor's page.
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// Lucide-style stroke icons, built with createElementNS (never innerHTML).
function icon(paths) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(k, v);
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
const chatIcon = () => icon(['M7.9 20A9 9 0 1 0 4 16.1L2 22Z']);
const closeIcon = () => icon(['M18 6 6 18', 'm6 6 12 12']);
const clipIcon = () => icon(['m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48']);
const sendIcon = () => icon([
  'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
  'm21.854 2.147-10.94 10.939',
]);
const fileIcon = () => icon(['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M16 13H8', 'M16 17H8', 'M10 9H8']);
const userIcon = () => icon(['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0']);

// Measured synchronously: the iframe starts hidden/0x0 and browsers may defer
// requestAnimationFrame there, which would mean the first resize is never sent.
let lastSize = { width: -1, height: -1 };

function reportSize() {
  const rect = root.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (width === lastSize.width && height === lastSize.height) return;
  lastSize = { width, height };
  tell('resize', { width, height, position: clampPosition(state.config?.theme?.bubble_position) });
}

// The chat log sticks to the newest message unless the visitor scrolled up to read.
let stick = true;

function render() {
  const active = document.activeElement;
  const caret = active && active.id === 'c-input' ? [active.selectionStart, active.selectionEnd] : null;
  const oldLog = document.getElementById('c-log');
  const oldTop = oldLog ? oldLog.scrollTop : 0;

  root.replaceChildren(state.open ? panel() : closed());

  const log = document.getElementById('c-log');
  if (log) log.scrollTop = stick ? log.scrollHeight : oldTop;
  growInput();
  if (caret) {
    const input = document.getElementById('c-input');
    if (input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(caret[0], caret[1]);
    }
  }
  reportSize();
}

// New messages while the chat is open: redraw only the log, so a half-typed message (and the
// keyboard on phones) is never disturbed.
function refreshChat() {
  const log = document.getElementById('c-log');
  if (!state.open || state.phase !== 'chat' || !log) {
    render();
    return;
  }
  log.replaceChildren(...logRows());
  if (stick) log.scrollTop = log.scrollHeight;
  reportSize();
}

function focusId(id) {
  document.getElementById(id)?.focus({ preventScroll: true });
}

function focusFirstError() {
  const field = fields().find((f) => state.errors[f.key]);
  focusId(field ? `f-${field.key}` : 'f-send');
}

function firstFieldId() {
  const first = fields()[0];
  return first ? `f-${first.key}` : 'f-send';
}

// Return focus to the launcher only for keyboard users — after a mouse click it would
// otherwise show the focus ring around the closed button.
let usingKeyboard = false;
document.addEventListener('keydown', () => { usingKeyboard = true; }, true);
document.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

function openPanel() {
  state.open = true;
  if (state.phase === 'chat') {
    state.unread = false;
    stick = true;
    markSeen();
  }
  render();
  if (state.phase === 'chat') schedulePoll(true);
  // Keyboard users land in the form (or the typing box); a mouse click leaves it unfocused, as in the design.
  if (usingKeyboard) focusId(state.phase === 'form' ? firstFieldId() : 'c-input');
}

function closePanel() {
  state.open = false;
  render();
  schedulePoll(); // closed: every 15 s for up to an hour after the last message
  if (usingKeyboard) focusId('w-launcher');
}

function dismissCallout(ev) {
  ev.stopPropagation();
  state.calloutDismissed = true;
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode: dismiss for this page only */ }
  render();
  if (usingKeyboard) focusId('w-launcher');
}

// One online team member: photo (or initials on their colour) with a green dot.
function face(member) {
  let inner;
  if (member.avatarUrl) {
    inner = h('img', { src: member.avatarUrl, alt: '' });
  } else {
    inner = h('span', { class: 'ini' }, member.initials);
    inner.style.background = member.color;
    inner.style.color = initialsInk(member.color);
  }
  return h('span', { class: 'face' }, inner, h('span', { class: 'dot' }));
}

function closed() {
  const cfg = state.config;
  const title = cfg.callout_text || DEFAULT_CALLOUT;
  const team = teamOnlineFrom(cfg);
  const left = clampPosition(cfg.theme?.bubble_position) === 'bottom-left';

  const callout = !state.calloutDismissed && h('div', { class: 'callout' },
    h('button', { class: 'callout-body', type: 'button', onclick: openPanel },
      team.length > 0 && h('span', { class: 'team' },
        h('span', { class: 'faces', 'aria-hidden': 'true' }, team.map(face)),
        h('span', { class: 'count' }, onlineCountText(team))),
      h('span', { class: 'title' }, title),
      h('span', { class: 'sub' }, CALLOUT_SUBTEXT)),
    h('button', { class: 'dismiss', type: 'button', 'aria-label': 'Dismiss', onclick: dismissCallout }, '×'));

  return h('div', { class: left ? 'closed left' : 'closed' },
    callout,
    h('button', {
      id: 'w-launcher', class: 'launcher', type: 'button', onclick: openPanel,
      'aria-label': state.unread ? `${title} (new message)` : title,
    }, chatIcon(), state.unread && h('span', { class: 'unread', 'aria-hidden': 'true' })));
}

// The agent's picture: their uploaded avatar, else the chat icon.
function agentPicture(className) {
  const logo = safeHttpsUrl(state.config.theme?.logo_url);
  return logo ? h('img', { src: logo, alt: '' }) : h('span', { class: className }, chatIcon());
}

function panel() {
  const cfg = state.config;
  const online = teamOnlineFrom(cfg).length > 0;
  const inChat = state.phase === 'chat';

  const head = h('div', { class: 'head' },
    h('span', { class: 'hav' }, agentPicture('icon'), online && h('span', { class: 'dot' })),
    h('div', { class: 'who' },
      h('h2', { id: 'w-title' }, cfg.agent_name || 'Chat with us'),
      h('p', {}, online ? [h('span', { class: 'on' }), 'Online now'] : "We'll reply soon")),
    h('button', { class: 'iconbtn close', type: 'button', 'aria-label': 'Close', onclick: closePanel }, closeIcon()));

  return h('div', { class: inChat ? 'panel chat' : 'panel', role: 'dialog', 'aria-labelledby': 'w-title' },
    head, inChat ? [chatLog(), composer()] : form());
}

// The intro sits beside the avatar's top; replies sit on its baseline (as in the design).
function botRow(text, time, align = 'bottom') {
  return h('div', { class: align === 'top' ? 'row bot top' : 'row bot' },
    h('span', { class: 'mini' }, agentPicture('')),
    h('div', { class: 'stack' }, h('div', { class: 'bubble' }, text), time && h('span', { class: 'time' }, time)));
}

// Per-field input attributes; which fields appear, their labels and required-ness come from the config.
const INPUTS = {
  name: { autocomplete: 'name' },
  mobile: { type: 'tel', autocomplete: 'tel' },
  email: { type: 'email', autocomplete: 'email', inputmode: 'email' },
  company: { autocomplete: 'organization' },
};

const canSend = () => !state.sending && fields().every((f) => !f.required || String(state.values[f.key] || '').trim() !== '');

function form() {
  const v = state.values;
  const e = state.errors;
  const shown = fields();
  const send = h('button', { id: 'f-send', class: 'send', type: 'submit', disabled: !canSend() }, state.sending ? 'Sending…' : 'Send Message');
  const bind = (key) => (ev) => {
    state.values[key] = ev.target.value;
    send.disabled = !canSend();
  };

  const controls = shown.map((f) => {
    const id = `f-${f.key}`;
    const common = {
      id, name: f.key, required: f.required, placeholder: placeholderFor(f),
      'aria-label': f.required ? f.label : `${f.label} (optional)`, 'aria-invalid': e[f.key] ? 'true' : false, oninput: bind(f.key),
    };
    const control = f.key === 'message'
      ? h('textarea', { ...common, maxlength: MESSAGE_MAX }, v.message)
      : h('input', { ...common, ...INPUTS[f.key], value: v[f.key] });
    return [control, e[f.key] && h('span', { class: 'err', role: 'alert' }, e[f.key])];
  });

  return h('div', { class: 'body' },
    botRow(state.config.welcome_subtext || DEFAULT_WELCOME, null, 'top'),
    h('form', { novalidate: true, onsubmit: submit },
      controls,
      h('p', { class: 'legal' }, consentText()),
      e.form && h('div', { class: 'err', role: 'alert' }, e.form),
      send));
}

function clock(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// --- Chat view -------------------------------------------------------------------------------

function chatLog() {
  return h('div', { id: 'c-log', class: 'body log', 'aria-live': 'polite', onscroll: onLogScroll }, logRows());
}

function onLogScroll(ev) {
  const el = ev.currentTarget;
  stick = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
}

function logRows() {
  const anchor = autoReplyAnchor(state.messages, state.submittedId);
  const rows = [];
  for (const m of state.messages) {
    rows.push(messageRow(m));
    if (m.id === anchor) rows.push(botRow(autoReplyText(state.visitorName), m.sentAt ? clock(m.sentAt) : null));
  }
  return rows;
}

function messageRow(m) {
  const time = m.sentAt ? clock(m.sentAt) : '';
  const content = [
    m.body.trim() !== '' && h('div', { class: 'bubble' }, m.body),
    m.attachments.length > 0 && h('div', { class: 'atts' }, m.attachments.map(attachmentView)),
  ];

  if (m.from === 'visitor') {
    return h('div', { class: 'row me' },
      h('div', { class: 'stack' }, content, time && h('span', { class: 'time' }, time)),
      h('span', { class: 'mini', 'aria-hidden': 'true' }, state.visitorName ? initialsFrom(state.visitorName) : userIcon()));
  }

  // Team: the rep's first name and photo (or initials on their colour). Messages without a Stasht
  // sender use the widget's agent picture and name.
  const who = m.sender ? m.sender.name : (state.config.agent_name || '');
  const meta = [who, time].filter(Boolean).join(' · ');
  return h('div', { class: 'row bot' },
    m.sender ? personMini(m.sender) : h('span', { class: 'mini' }, agentPicture('')),
    h('div', { class: 'stack' }, content, meta && h('span', { class: 'time' }, meta)));
}

function personMini(person) {
  if (person.avatarUrl) return h('span', { class: 'mini' }, h('img', { src: person.avatarUrl, alt: '' }));
  const el = h('span', { class: 'mini ini' }, person.initials);
  el.style.background = person.color;
  el.style.color = initialsInk(person.color);
  return el;
}

// Photos show inline (tap opens full size in a new tab); PDFs are a file chip linking to the file.
function attachmentView(a) {
  if (a.isImage) {
    return h('a', { class: 'att-img', href: a.url, target: '_blank', rel: 'noopener noreferrer', title: a.filename },
      h('img', { src: a.url, alt: a.filename, onload: keepAtBottom }));
  }
  return h('a', { class: 'att-file', href: a.url, target: '_blank', rel: 'noopener noreferrer' },
    h('span', { class: 'ficon' }, fileIcon()), h('span', { class: 'fname' }, a.filename));
}

// Photos load after the log is drawn; keep the newest message in view as they do.
function keepAtBottom() {
  const log = document.getElementById('c-log');
  if (log && stick) log.scrollTop = log.scrollHeight;
}

function composer() {
  return h('div', { class: 'composer' },
    state.files.length > 0 && h('div', { class: 'queue' }, state.files.map(chip)),
    h('div', { class: 'bar' },
      h('button', {
        id: 'c-attach', class: 'clip', type: 'button', 'aria-label': 'Attach a photo or PDF', disabled: state.chatSending,
        onclick: () => document.getElementById('c-file')?.click(),
      }, clipIcon()),
      h('input', { id: 'c-file', type: 'file', accept: CHAT_FILE_TYPES.join(','), multiple: true, hidden: true, onchange: onFilesPicked }),
      h('textarea', {
        id: 'c-input', rows: 1, maxlength: CHAT_MESSAGE_MAX, placeholder: 'Type a message…', 'aria-label': 'Message',
        oninput: onDraftInput, onkeydown: onDraftKey,
      }, state.draft),
      h('button', { id: 'c-send', class: 'sendbtn', type: 'button', 'aria-label': 'Send', disabled: !canSendChat(), onclick: sendChat }, sendIcon())),
    state.chatError && h('div', { class: 'err', role: 'alert' }, state.chatError));
}

function chip(item, index) {
  const isImage = item.file.type.startsWith('image/');
  return h('div', { class: 'chip' },
    isImage && item.previewUrl ? h('img', { src: item.previewUrl, alt: '' }) : h('span', { class: 'ficon' }, fileIcon()),
    h('span', { class: 'cname' }, item.file.name),
    h('button', { class: 'x', type: 'button', 'aria-label': `Remove ${item.file.name}`, onclick: () => removeFile(index) }, '×'));
}

const canSendChat = () => !state.chatSending && chatSendProblem(state.draft, state.files.length) === null;

function growInput() {
  const input = document.getElementById('c-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
}

function onDraftInput(ev) {
  state.draft = ev.target.value;
  growInput();
  const send = document.getElementById('c-send');
  if (send) send.disabled = !canSendChat();
  if (state.chatError) {
    state.chatError = '';
    document.querySelector('.composer .err')?.remove();
    reportSize();
  }
}

function onDraftKey(ev) {
  // Enter sends; Shift+Enter starts a new line; an IME composition is left alone.
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    sendChat();
  }
}

function onFilesPicked(ev) {
  const { accepted, error } = acceptChatFiles(state.files.length, Array.from(ev.target.files || []));
  state.files = state.files.concat(accepted.map((file) => ({
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
  })));
  state.chatError = error || '';
  ev.target.value = ''; // picking the same file again still fires change
  render();
}

function releaseFile(item) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

function removeFile(index) {
  releaseFile(state.files[index]);
  state.files = state.files.filter((_, i) => i !== index);
  state.chatError = '';
  render();
  focusId('c-attach');
}

// --- Chat state and the server ---------------------------------------------------------------

const chatHeaders = () => ({ Accept: 'application/json', 'X-Widget-Chat-Token': state.token });

// A synthetic id for the visitor's own message when /submit's response can't be shown as-is (an
// older API during a deploy, or any malformed reply): never a real server id (those are positive
// integers), so it can't collide, and it's dropped as soon as a real copy of the message arrives.
const PLACEHOLDER_VISITOR_ID = -1;

// Remembers the conversation in this browser, and when the visitor last looked at it.
function markSeen() {
  if (state.token) writeChatToken(chatStore, widgetId, state.token);
}

// After the form: the chat starts from the visitor's own message (and any instant replies). If
// the server's copy of the visitor's own message isn't usable, show what they typed locally
// anyway — landing in an empty chat with no acknowledgement of what they just sent would be worse.
function startChat(data, sentText = '') {
  const ownMessage = chatMessageFrom(data.message) || {
    id: PLACEHOLDER_VISITOR_ID,
    from: 'visitor',
    body: sentText,
    sentAt: new Date(),
    attachments: [],
    sender: null,
  };
  const replies = (Array.isArray(data.replies) ? data.replies : []).map(chatMessageFrom).filter(Boolean);
  state.token = data.conversation_token;
  state.phase = 'chat';
  state.messages = mergeMessages([], [ownMessage, ...replies]);
  state.submittedId = ownMessage.id;
  state.lastActivity = Date.now();
  stick = true;
  markSeen();
  schedulePoll();
}

// The server no longer knows this conversation (older than 30 days, a newer form submission took
// over, or the widget was switched off): forget it and show the form, keeping any draft.
function conversationGone() {
  clearChatToken(chatStore, widgetId);
  clearTimeout(pollTimer);
  pollTimer = null;
  if (state.draft.trim()) state.values.message = state.draft.trim().slice(0, MESSAGE_MAX);
  state.files.forEach(releaseFile);
  Object.assign(state, {
    token: null, messages: [], submittedId: null, phase: 'form', draft: '', files: [], chatError: '', chatSending: false, unread: false,
  });
  render();
}

async function sendChat() {
  if (state.chatSending || state.phase !== 'chat') return;
  const problem = chatSendProblem(state.draft, state.files.length);
  if (problem) {
    state.chatError = problem;
    render();
    return;
  }

  const body = new FormData();
  const text = state.draft.trim();
  if (text) body.append('body', text);
  for (const item of state.files) body.append('files[]', item.file, item.file.name);

  state.chatSending = true;
  state.chatError = '';
  render();
  let sent = false;
  try {
    const res = await fetch(messagesUrl(API, widgetId), { method: 'POST', headers: chatHeaders(), body });
    if (res.status === 404) {
      conversationGone();
      return;
    }
    const json = await res.json().catch(() => null);
    if (res.status === 422) {
      state.chatError = firstServerError(json, 'Please check your message and try again.');
    } else if (res.status === 429) {
      state.chatError = "You're sending messages quickly. Please wait a moment and try again.";
    } else if (!res.ok || !json?.data?.message) {
      state.chatError = 'Something went wrong. Please try again.';
    } else {
      const incoming = [json.data.message, ...(Array.isArray(json.data.replies) ? json.data.replies : [])];
      state.messages = mergeMessages(state.messages, incoming.map(chatMessageFrom).filter(Boolean));
      state.draft = '';
      state.files.forEach(releaseFile);
      state.files = [];
      state.lastActivity = Date.now();
      stick = true;
      markSeen();
      sent = true;
    }
  } catch {
    state.chatError = 'Could not reach the server. Check your connection and try again.';
  } finally {
    state.chatSending = false;
    if (state.phase === 'chat') {
      render();
      if (sent) focusId('c-input');
      schedulePoll();
    }
  }
}

// Checking for replies (spec §2): every 3 s open; every 15 s closed for up to 60 min after the
// last message; then nothing until the visitor opens the widget again. One timer at a time.
let pollTimer = null;
let pollFailures = 0;
let polling = false;

function schedulePoll(immediately = false) {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (state.phase !== 'chat' || !state.token) return;
  if (immediately) {
    poll();
    return;
  }
  const base = nextPollDelay({ open: state.open, lastActivityAt: state.lastActivity, now: Date.now() });
  if (base === null) return; // an hour quiet with the panel closed: wait until the visitor opens it
  pollTimer = setTimeout(poll, backoffDelay(base, pollFailures));
}

async function poll() {
  if (polling || state.phase !== 'chat' || !state.token) return;
  polling = true;
  try {
    for (;;) {
      const res = await fetch(messagesUrl(API, widgetId, lastMessageId(state.messages)), { headers: chatHeaders() });
      if (res.status === 404) {
        conversationGone();
        return;
      }
      if (!res.ok) {
        pollFailures += 1; // 429 or a server hiccup: back off and try again later
        return;
      }
      const json = await res.json();
      pollFailures = 0;
      const added = applyIncoming(json?.data?.messages);
      if (!added || json?.data?.has_more !== true) return;
    }
  } catch {
    pollFailures += 1;
  } finally {
    polling = false;
    schedulePoll();
  }
}

// Messages from a check: new team messages while the panel is closed light the unread dot.
function applyIncoming(list) {
  const known = new Set(state.messages.map((m) => m.id));
  const fresh = (Array.isArray(list) ? list : []).map(chatMessageFrom).filter((m) => m && !known.has(m.id));
  if (!fresh.length) return false;
  // The visitor's own message finally came back from the server (see startChat): drop the local
  // placeholder so it isn't shown twice, and point the automatic reply at the real message instead.
  const realOwn = fresh.find((m) => m.from === 'visitor');
  if (realOwn && state.messages.some((m) => m.id === PLACEHOLDER_VISITOR_ID)) {
    state.messages = state.messages.filter((m) => m.id !== PLACEHOLDER_VISITOR_ID);
    if (state.submittedId === PLACEHOLDER_VISITOR_ID) state.submittedId = realOwn.id;
  }
  state.messages = mergeMessages(state.messages, fresh);
  state.lastActivity = Date.now();
  if (state.open) {
    markSeen();
    refreshChat();
  } else {
    if (fresh.some((m) => m.from === 'team')) state.unread = true;
    render();
  }
  return true;
}

// A returning visitor goes straight back into their conversation (no form) when this browser
// still holds a token younger than 30 days and the server still knows it.
async function resumeChat() {
  const saved = readChatToken(chatStore, widgetId);
  if (!saved) return;
  state.token = saved.token;
  state.phase = 'chat';
  try {
    for (;;) {
      const res = await fetch(messagesUrl(API, widgetId, lastMessageId(state.messages)), { headers: chatHeaders() });
      if (res.status === 404) {
        clearChatToken(chatStore, widgetId);
        Object.assign(state, { token: null, phase: 'form', messages: [] });
        return;
      }
      if (!res.ok) break; // keep the chat: polling fills it in
      const json = await res.json();
      const page = (Array.isArray(json?.data?.messages) ? json.data.messages : []).map(chatMessageFrom).filter(Boolean);
      state.messages = mergeMessages(state.messages, page);
      if (!page.length || json?.data?.has_more !== true) break;
    }
  } catch {
    // offline for now: polling retries once the panel is open
  }
  const newest = state.messages[state.messages.length - 1];
  state.lastActivity = newest?.sentAt ? newest.sentAt.getTime() : saved.updatedAt;
  state.unread = hasUnreadTeamMessage(state.messages, saved.updatedAt);
}

// --- The form --------------------------------------------------------------------------------

async function submit(ev) {
  ev.preventDefault();
  if (state.sending) return;

  const v = state.values;
  const shown = fields();
  const errors = validateValues(shown, v);
  state.errors = errors;
  if (Object.keys(errors).length) {
    render();
    focusFirstError();
    return;
  }

  state.sending = true;
  render();
  let focusTarget = null; // 'errors' | 'send' | 'chat'
  try {
    const res = await fetch(`${API}/widgets/${encodeURIComponent(widgetId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...Object.fromEntries(shown.map((f) => [f.key, v[f.key].trim()])),
        host_origin: hostOrigin({ hostParam: params.get('host'), referrer: document.referrer }),
      }),
    });

    if (res.status === 404) {
      tell('hide'); // widget was paused or removed
    } else if (res.status === 422) {
      const body = (await res.json().catch(() => null)) || {};
      state.errors = Object.fromEntries(
        Object.entries(body.errors || {}).map(([k, msgs]) => [k, Array.isArray(msgs) ? msgs[0] : String(msgs)]),
      );
      if (!shown.some((f) => state.errors[f.key])) {
        state.errors = { form: 'Please check your details and try again.' };
      }
      focusTarget = 'errors';
    } else if (res.status === 429) {
      state.errors = { form: 'Too many attempts. Please wait a minute and try again.' };
      focusTarget = 'send';
    } else if (!res.ok) {
      state.errors = { form: 'Something went wrong. Please try again.' };
      focusTarget = 'send';
    } else {
      const body = (await res.json().catch(() => null)) || {};
      if (!body.data?.conversation_token) {
        state.errors = { form: 'Something went wrong. Please try again.' };
        focusTarget = 'send';
      } else {
        state.errors = {};
        state.visitorName = v.name.trim();
        const sentText = v.message.trim();
        state.values.message = '';
        startChat(body.data, sentText);
        focusTarget = 'chat';
      }
    }
  } catch {
    state.errors = { form: 'Could not reach the server. Check your connection and try again.' };
    focusTarget = 'send';
  } finally {
    state.sending = false;
    render();
    if (focusTarget === 'errors') focusFirstError();
    else if (focusTarget === 'send') focusId('f-send');
    else if (focusTarget === 'chat' && usingKeyboard) focusId('c-input');
  }
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.open) closePanel();
});

async function init() {
  if (!/^w_[a-z0-9]{10}$/.test(widgetId)) return tell('hide');

  try {
    const host = hostOrigin({ hostParam: params.get('host'), referrer: document.referrer });
    const res = await fetch(configUrl(API, widgetId, host), { headers: { Accept: 'application/json' } });
    if (!res.ok) return tell('hide');
    const body = await res.json();
    if (!body || !body.data) return tell('hide');
    state.config = body.data;
  } catch {
    return tell('hide');
  }

  const style = document.documentElement.style;
  style.setProperty('--brand', safeColor(state.config.theme?.primary_color));
  style.setProperty('--brand-ink', contrastInk(state.config.theme?.primary_color));
  style.setProperty('--panel-w', `${panelWidth(Number(params.get('vw')))}px`);
  style.setProperty('--panel-max-h', `${panelMaxHeight(Number(params.get('vh')))}px`);

  await resumeChat();

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportSize).observe(root);
  render();
  schedulePoll();
}

init();
