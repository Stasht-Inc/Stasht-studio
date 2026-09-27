// public/widget-embed.js
// Layout follows Chris's ContactWidget frames: a callout card with who's online above a round
// launcher; an open panel with the agent header, an intro bubble and the form; after sending,
// the visitor's message and an instant reply as chat bubbles. (Live two-way chat comes later.)
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, clampPosition, panelWidth, panelMaxHeight, MESSAGE_MAX,
  configUrl, ROOT_PAD, formFieldsFrom, validateValues, consentText, placeholderFor, autoReplyText, initialsFrom,
  teamOnlineFrom, onlineCountText, initialsInk, DEFAULT_CALLOUT, CALLOUT_SUBTEXT, DEFAULT_WELCOME,
} from './widget-core.js';

const params = new URLSearchParams(location.search);
const widgetId = params.get('w') || '';
const API = `${location.origin}/api/react`;
const root = document.getElementById('root');
root.style.padding = `${ROOT_PAD.top}px ${ROOT_PAD.x}px ${ROOT_PAD.bottom}px`;

const DISMISS_KEY = `stasht-widget-callout-dismissed:${widgetId}`;

const state = {
  config: null,
  open: false,
  phase: 'form', // 'form' | 'sent'
  sending: false,
  errors: {},
  values: { name: '', mobile: '', email: '', company: '', message: '' },
  sent: null, // { text, name, at: Date } — what the visitor sent, for the chat view
  calloutDismissed: readDismissed(),
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
// so widget-owner-supplied copy can never inject markup into a visitor's page.
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
const backIcon = () => icon(['m12 19-7-7 7-7', 'M19 12H5']);

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

function render() {
  root.replaceChildren(state.open ? panel() : closed());
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
  render();
  // Keyboard users land in the form; a mouse click leaves it unfocused, as in the design.
  if (usingKeyboard) focusId(state.phase === 'form' ? firstFieldId() : 'w-back');
}

function closePanel() {
  state.open = false;
  render();
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
    h('button', { id: 'w-launcher', class: 'launcher', type: 'button', 'aria-label': title, onclick: openPanel }, chatIcon()));
}

// The agent's picture: their uploaded avatar, else the chat icon.
function agentPicture(className) {
  const logo = safeHttpsUrl(state.config.theme?.logo_url);
  return logo ? h('img', { src: logo, alt: '' }) : h('span', { class: className }, chatIcon());
}

function panel() {
  const cfg = state.config;
  const online = teamOnlineFrom(cfg).length > 0;
  const sent = state.phase === 'sent';

  const head = h('div', { class: 'head' },
    sent && h('button', { id: 'w-back', class: 'iconbtn', type: 'button', 'aria-label': 'Send another message', onclick: newMessage }, backIcon()),
    h('span', { class: 'hav' }, agentPicture('icon'), online && h('span', { class: 'dot' })),
    h('div', { class: 'who' },
      h('h2', { id: 'w-title' }, cfg.agent_name || 'Chat with us'),
      h('p', {}, online ? [h('span', { class: 'on' }), 'Online now'] : "We'll reply soon")),
    h('button', { class: 'iconbtn close', type: 'button', 'aria-label': 'Close', onclick: closePanel }, closeIcon()));

  return h('div', { class: 'panel', role: 'dialog', 'aria-labelledby': 'w-title' }, head, sent ? chat() : form());
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

function chat() {
  const s = state.sent;
  const time = clock(s.at);
  return h('div', { class: 'body', 'aria-live': 'polite' },
    h('div', { class: 'row me' },
      h('div', { class: 'stack' }, h('div', { class: 'bubble' }, s.text), h('span', { class: 'time' }, time)),
      h('span', { class: 'mini', 'aria-hidden': 'true' }, initialsFrom(s.name))),
    botRow(autoReplyText(s.name), time));
}

function newMessage() {
  state.phase = 'form';
  state.values.message = '';
  state.errors = {};
  render();
  focusId(fields().some((f) => f.key === 'message') ? 'f-message' : firstFieldId());
}

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
  let focusTarget = null; // 'errors' | 'send' | 'sent'
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
      state.errors = {};
      state.sent = { text: v.message.trim() || 'Sent the contact form', name: v.name.trim(), at: new Date() };
      state.phase = 'sent';
      focusTarget = 'sent';
    }
  } catch {
    state.errors = { form: 'Could not reach the server. Check your connection and try again.' };
    focusTarget = 'send';
  } finally {
    state.sending = false;
    render();
    if (focusTarget === 'errors') focusFirstError();
    else if (focusTarget === 'send') focusId('f-send');
    else if (focusTarget === 'sent') focusId('w-back');
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
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportSize).observe(root);
  render();
}

init();
