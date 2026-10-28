// Contact Us widget screenshots for ClickUp wdy2xh2upu (team faces + assistant, taking over):
//   node tests/widget/ui/shots.mjs            the widget only (public/widget-embed.*, nothing else needed)
//   WIDGET_UI_BASE=http://localhost:5199 node tests/widget/ui/shots.mjs
//                                             also the lead drawer's bar (needs `npx vite --port 5199` running)
// The embed runs from this checkout's public/ with every request answered here (config, messages, photos):
// nothing leaves this machine. Screenshots go to WIDGET_SHOTS (default: /private/tmp/widget-shots).
import { mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pw from '/Users/deepaksharma/.nvm/versions/node/v24.5.0/lib/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright-core/index.js';

const { chromium } = pw;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.env.WIDGET_SHOTS || '/private/tmp/widget-shots';
const PREFIX = process.env.WIDGET_SHOT_PREFIX || 'widget-takeover-';
const BASE = process.env.WIDGET_UI_BASE || '';
const ORIGIN = 'https://studio.widget.test';
const WIDGET = 'w_abcdefghij';
mkdirSync(OUT, { recursive: true });

// Photos as SVG: a person (warm background) and Chip (the assistant: a friendly bot on Stasht purple).
const personSvg = (bg, skin, hair) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>`
  + `<circle cx="32" cy="27" r="12" fill="${skin}"/><path d="M20 25c0-9 6-13 12-13s12 4 12 13c-3-5-7-6-12-6s-9 1-12 6z" fill="${hair}"/>`
  + `<path d="M10 64c2-13 11-19 22-19s20 6 22 19z" fill="#1f2937"/></svg>`;
const PHOTOS = {
  'chris.svg': personSvg('#f4d6b8', '#e8b48f', '#5b3a29'),
  'alex.svg': personSvg('#c7e3f7', '#c98e6a', '#1f1f1f'),
  'chip.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#6C60FF"/>'
    + '<rect x="16" y="20" width="32" height="26" rx="9" fill="#fff"/><circle cx="26" cy="33" r="3.5" fill="#6C60FF"/><circle cx="38" cy="33" r="3.5" fill="#6C60FF"/>'
    + '<rect x="30" y="11" width="4" height="9" rx="2" fill="#fff"/><circle cx="32" cy="10" r="3.5" fill="#FF5FAD"/></svg>',
};
const photo = (name) => `https://cdn.widget.test/${name}`;

const CHRIS = { name: 'Chris', avatar_url: photo('chris.svg'), initials: 'CB', color: '#10B981' };
const SAM = { name: 'Sam', avatar_url: null, initials: 'SR', color: '#F59E0B' };
const ALEX = { name: 'Alex', avatar_url: photo('alex.svg'), initials: 'AK', color: '#3B82F6' };

const config = (over = {}) => ({
  id: WIDGET, agent_name: 'Chip (AI Assistant)', callout_text: null, welcome_subtext: null,
  theme: { primary_color: '#6C60FF', logo_url: photo('chip.svg'), bubble_position: 'bottom-right' },
  form_fields: [
    { key: 'name', label: 'Name', required: true }, { key: 'mobile', label: 'Mobile Number', required: true },
    { key: 'message', label: 'Message', required: true },
  ],
  shown_paths: [], business_name: 'Stasht Support', team_online: [CHRIS], assistant_online: true, ...over,
});

// The conversation after Chris pressed "Take over" in Studio, then wrote.
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const TAKEOVER_CHAT = [
  { id: 101, from: 'visitor', body: 'Hi, do you have the Jeep Grand Cherokee in black?', sent_at: minutesAgo(9) },
  { id: 102, from: 'team', body: "Yes! We have a 2022 Grand Cherokee Limited in black with 42,000 km. Would you like to book a test drive?", sent_at: minutesAgo(9), is_ai: true },
  { id: 103, from: 'visitor', body: 'Can I get a better price if I trade in my car?', sent_at: minutesAgo(6) },
  { id: 104, from: 'team', body: '', sent_at: minutesAgo(5), sender: CHRIS, event: 'takeover' },
  { id: 105, from: 'team', body: "Hi Jordan, Chris here. Happy to look at your trade-in. What are you driving now?", sent_at: minutesAgo(4), sender: CHRIS },
].map((m) => ({ attachments: [], sender: null, is_ai: false, auto_reply: false, campaign: null, products: [], event: null, ...m }));

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const pageErrors = [];
const shots = [];

async function widget(file, { cfg = config(), messages = null, open = false, width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.hostname === 'cdn.widget.test') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTOS[url.pathname.slice(1)] || '' });
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname.endsWith('/config')) return json({ success: true, data: cfg });
    if (url.pathname.endsWith('/messages')) {
      const after = Number(url.searchParams.get('after') || 0);
      return json({ success: true, data: { messages: (messages || []).filter((m) => m.id > after), has_more: false } });
    }
    const file = path.join(ROOT, 'public', url.pathname);
    const type = file.endsWith('.js') ? 'text/javascript' : 'text/html';
    return route.fulfill({ status: 200, contentType: type, body: readFileSync(file) });
  });
  if (messages) {
    await context.addInitScript(([key]) => {
      localStorage.setItem(key, JSON.stringify({ token: 'tok-harness', updatedAt: Date.now() }));
    }, [`stasht-widget-chat:${WIDGET}`]);
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${file}: ${e.message}`));
  await page.goto(`${ORIGIN}/widget-embed.html?w=${WIDGET}&vw=${width}&vh=${height}&path=/`);
  // The page behind the widget, so its shadows read as they do on a website.
  await page.addStyleTag({ content: 'html, body { background: #eef0f5 !important; }' });
  await page.waitForSelector('#w-launcher, .panel');
  if (open) {
    await page.click('#w-launcher');
    await page.waitForSelector('.panel');
  }
  await page.waitForTimeout(300);
  const out = `${OUT}/${PREFIX}${file}.png`;
  await page.locator('#root').screenshot({ path: out });
  shots.push(out);
  await context.close();
}

await widget('teaser-1rep', { cfg: config({ team_online: [CHRIS] }) });
await widget('teaser-3reps', { cfg: config({ team_online: [CHRIS, SAM, ALEX] }) });
await widget('header-reps', { cfg: config({ team_online: [CHRIS, SAM, ALEX] }), open: true });
await widget('header-no-reps', { cfg: config({ team_online: [] }), open: true });
await widget('header-no-reps-ai-off', { cfg: config({ team_online: [], assistant_online: false }), open: true });
await widget('chat-after-takeover', { cfg: config({ team_online: [SAM, CHRIS] }), messages: TAKEOVER_CHAT, open: true });
await widget('header-phone', { cfg: config({ team_online: [CHRIS, SAM, ALEX] }), open: true, width: 375, height: 700 });

if (BASE) {
  const context = await browser.newContext({ viewport: { width: 760, height: 700 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`drawer: ${e.message}`));
  await page.goto(`${BASE}/tests/widget/ui/drawer-bar.html`);
  await page.waitForSelector('[data-testid="widget-ai-bar"]');
  await page.waitForTimeout(300);
  const states = page.locator('section[data-state]');
  for (const [i, file] of ['drawer-bar-answering', 'drawer-bar-handling', 'drawer-bar-teammate'].entries()) {
    const out = `${OUT}/${PREFIX}${file}.png`;
    await states.nth(i).screenshot({ path: out });
    shots.push(out);
  }
  await context.close();
}

await browser.close();
shots.forEach((s) => console.log('shot', s));
if (pageErrors.length) {
  console.error('page errors:\n' + pageErrors.join('\n'));
  process.exit(1);
}
