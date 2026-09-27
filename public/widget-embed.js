// public/widget-embed.js
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, clampPosition, panelWidth, panelMaxHeight, MESSAGE_MAX,
  configUrl, ROOT_PAD, formFieldsFrom, fieldLabel, validateValues, consentText, thanksText,
  teamOnlineFrom, onlineLabel,
} from './widget-core.js';

const params = new URLSearchParams(location.search);
const widgetId = params.get('w') || '';
const API = `${location.origin}/api/react`;
const root = document.getElementById('root');
root.style.padding = `${ROOT_PAD.top}px ${ROOT_PAD.x}px ${ROOT_PAD.bottom}px`;

const state = {
  config: null,
  open: false,
  phase: 'form', // 'form' | 'sent'
  sending: false,
  errors: {},
  values: { name: '', mobile: '', email: '', company: '', message: '' },
};

// The shown fields, in order (set once the config loads).
const fields = () => formFieldsFrom(state.config);

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

function chatIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  svg.append(path);
  return svg;
}

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
  root.replaceChildren(state.open ? panel() : launcher());
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

function openPanel() {
  state.open = true;
  render();
  focusId(state.phase === 'form' ? firstFieldId() : 'w-thanks');
}

function closePanel() {
  state.open = false;
  render();
  focusId('w-launcher');
}

function launcher() {
  const label = state.config.callout_text || 'Chat with us';
  return h('button', { id: 'w-launcher', class: 'launcher', type: 'button', 'aria-label': label, onclick: openPanel }, chatIcon(), h('span', {}, label));
}

// One online team member: photo (or initials on their colour) with a green dot.
function face(member) {
  let inner;
  if (member.avatarUrl) {
    inner = h('img', { src: member.avatarUrl, alt: '' });
  } else {
    inner = h('span', { class: 'ini' }, member.initials);
    inner.style.background = member.color;
    inner.style.color = contrastInk(member.color);
  }
  return h('span', { class: 'face' }, inner, h('span', { class: 'dot' }));
}

function panel() {
  const cfg = state.config;
  const logo = safeHttpsUrl(cfg.theme?.logo_url);
  const team = teamOnlineFrom(cfg);
  const head = h('div', { class: 'head' },
    (cfg.agent_name || logo) && h('div', { class: 'agent' },
      logo && h('img', { src: logo, alt: '' }),
      cfg.agent_name && h('span', {}, cfg.agent_name)),
    h('h2', { id: 'w-title' }, cfg.callout_text || 'Chat with us'),
    cfg.welcome_subtext && h('p', {}, cfg.welcome_subtext),
    team.length > 0 && h('div', { class: 'online' },
      h('span', { class: 'faces', 'aria-hidden': 'true' }, team.map(face)),
      h('span', {}, onlineLabel(team))),
    h('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: closePanel }, '×'));

  return h('div', { class: 'panel', role: 'dialog', 'aria-labelledby': 'w-title' }, head, state.phase === 'sent' ? thanks() : form());
}

function field(id, label, control, error) {
  return h('label', { for: id }, label, control, error && h('span', { class: 'err', role: 'alert' }, error));
}

// Per-field input attributes; which fields appear, their labels and required-ness come from the config.
const INPUTS = {
  name: { autocomplete: 'name' },
  mobile: { type: 'tel', autocomplete: 'tel' },
  email: { type: 'email', autocomplete: 'email', inputmode: 'email' },
  company: { autocomplete: 'organization' },
};

function form() {
  const v = state.values;
  const e = state.errors;
  const shown = fields();
  const counter = h('span', { class: 'count' }, `${v.message.length}/${MESSAGE_MAX}`);
  const bind = (key) => (ev) => {
    state.values[key] = ev.target.value;
    if (key === 'message') counter.textContent = `${ev.target.value.length}/${MESSAGE_MAX}`;
  };

  const controls = shown.map((f) => {
    const id = `f-${f.key}`;
    const control = f.key === 'message'
      ? h('textarea', { id, name: 'message', maxlength: MESSAGE_MAX, required: f.required, oninput: bind('message') }, v.message)
      : h('input', { id, name: f.key, ...INPUTS[f.key], required: f.required, value: v[f.key], oninput: bind(f.key) });
    return [field(id, fieldLabel(f), control, e[f.key]), f.key === 'message' && counter];
  });

  return h('form', { novalidate: true, onsubmit: submit },
    controls,
    e.form && h('div', { class: 'err', role: 'alert' }, e.form),
    h('button', { id: 'f-send', class: 'send', type: 'submit', disabled: state.sending }, state.sending ? 'Sending…' : 'Send Message'),
    h('p', { class: 'legal' }, consentText(shown)));
}

function thanks() {
  const first = state.values.name.trim().split(/\s+/)[0];
  const again = fields().some((f) => f.key === 'message') ? 'f-message' : firstFieldId();
  return h('div', { class: 'thanks' },
    h('h3', { id: 'w-thanks', tabindex: '-1' }, first ? `Thanks, ${first}!` : 'Thanks!'),
    h('p', {}, thanksText(state.values)),
    h('button', {
      class: 'linkbtn', type: 'button',
      onclick: () => { state.phase = 'form'; state.values.message = ''; render(); focusId(again); },
    }, 'Send another message'));
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
  let focusTarget = null; // 'errors' | 'send' | 'thanks'
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
      state.phase = 'sent';
      focusTarget = 'thanks';
    }
  } catch {
    state.errors = { form: 'Could not reach the server. Check your connection and try again.' };
    focusTarget = 'send';
  } finally {
    state.sending = false;
    render();
    if (focusTarget === 'errors') focusFirstError();
    else if (focusTarget === 'send') focusId('f-send');
    else if (focusTarget === 'thanks') focusId('w-thanks');
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
