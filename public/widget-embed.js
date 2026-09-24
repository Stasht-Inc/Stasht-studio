// public/widget-embed.js
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, isPlausiblePhone, clampPosition, panelWidth, MESSAGE_MAX,
} from './widget-core.js';

const params = new URLSearchParams(location.search);
const widgetId = params.get('w') || '';
const API = `${location.origin}/api/react`;
const root = document.getElementById('root');

const state = {
  config: null,
  open: false,
  phase: 'form', // 'form' | 'sent'
  sending: false,
  errors: {},
  values: { name: '', mobile: '', company: '', message: '' },
};

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
  for (const child of children.flat()) {
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
  const key = ['name', 'mobile', 'company', 'message'].find((k) => state.errors[k]);
  focusId(key ? `f-${key}` : 'f-send');
}

function openPanel() {
  state.open = true;
  render();
  focusId(state.phase === 'form' ? 'f-name' : 'w-thanks');
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

function panel() {
  const cfg = state.config;
  const logo = safeHttpsUrl(cfg.theme?.logo_url);
  const head = h('div', { class: 'head' },
    (cfg.agent_name || logo) && h('div', { class: 'agent' },
      logo && h('img', { src: logo, alt: '' }),
      cfg.agent_name && h('span', {}, cfg.agent_name)),
    h('h2', { id: 'w-title' }, cfg.callout_text || 'Chat with us'),
    cfg.welcome_subtext && h('p', {}, cfg.welcome_subtext),
    h('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: closePanel }, '×'));

  return h('div', { class: 'panel', role: 'dialog', 'aria-labelledby': 'w-title' }, head, state.phase === 'sent' ? thanks() : form());
}

function field(id, label, control, error) {
  return h('label', { for: id }, label, control, error && h('span', { class: 'err', role: 'alert' }, error));
}

function form() {
  const v = state.values;
  const e = state.errors;
  const counter = h('span', { class: 'count' }, `${v.message.length}/${MESSAGE_MAX}`);
  const bind = (key) => (ev) => {
    state.values[key] = ev.target.value;
    if (key === 'message') counter.textContent = `${ev.target.value.length}/${MESSAGE_MAX}`;
  };

  return h('form', { novalidate: true, onsubmit: submit },
    field('f-name', 'Name', h('input', { id: 'f-name', name: 'name', autocomplete: 'name', required: true, value: v.name, oninput: bind('name') }), e.name),
    field('f-mobile', 'Mobile Number', h('input', { id: 'f-mobile', name: 'mobile', type: 'tel', autocomplete: 'tel', required: true, value: v.mobile, oninput: bind('mobile') }), e.mobile),
    field('f-company', 'Company Name (optional)', h('input', { id: 'f-company', name: 'company', autocomplete: 'organization', value: v.company, oninput: bind('company') }), e.company),
    field('f-message', 'Message', h('textarea', { id: 'f-message', name: 'message', maxlength: MESSAGE_MAX, required: true, oninput: bind('message') }, v.message), e.message),
    counter,
    e.form && h('div', { class: 'err', role: 'alert' }, e.form),
    h('button', { id: 'f-send', class: 'send', type: 'submit', disabled: state.sending }, state.sending ? 'Sending…' : 'Send Message'),
    h('p', { class: 'legal' }, 'By submitting, you authorize this business to send messages to the number you provided. Message and data rates may apply.'));
}

function thanks() {
  const first = state.values.name.trim().split(/\s+/)[0];
  return h('div', { class: 'thanks' },
    h('h3', { id: 'w-thanks', tabindex: '-1' }, first ? `Thanks, ${first}!` : 'Thanks!'),
    h('p', {}, "Your message was sent. We'll text you shortly."),
    h('button', {
      class: 'linkbtn', type: 'button',
      onclick: () => { state.phase = 'form'; state.values.message = ''; render(); focusId('f-message'); },
    }, 'Send another message'));
}

async function submit(ev) {
  ev.preventDefault();
  if (state.sending) return;

  const v = state.values;
  const errors = {};
  if (!v.name.trim()) errors.name = 'Enter your name.';
  if (!isPlausiblePhone(v.mobile)) errors.mobile = 'Enter a valid phone number, including the area code.';
  if (!v.message.trim()) errors.message = 'Enter a message.';
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
        name: v.name.trim(),
        mobile: v.mobile.trim(),
        company: v.company.trim(),
        message: v.message.trim(),
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
      if (!['name', 'mobile', 'company', 'message'].some((k) => state.errors[k])) {
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
    const res = await fetch(`${API}/widget-embed/${encodeURIComponent(widgetId)}/config`, { headers: { Accept: 'application/json' } });
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
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportSize).observe(root);
  render();
}

init();
