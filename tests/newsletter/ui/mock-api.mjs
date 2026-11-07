// In-memory stand-in for /api/react used by the newsletter screenshot checks. Shapes follow spec 2026-10-13 §8.
// Nothing leaves the machine: route() aborts every non-local request except the image hosts it answers itself.
import { smsPartsInfo } from '../../../components/newsletters/lib/smsParts.ts';
import { smsPlain } from '../../../components/newsletters/lib/rules.ts';

const PUBLIC_DIR = new URL('../../../public/', import.meta.url).pathname;
// NewsletterSendController::schedule: texts only between 8:00 and 21:00 in NEWSLETTER_DEFAULT_TIMEZONE.
const torontoHour = (ms) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));
const QUIET_HOURS_ERROR = 'Texts can only go out between 8am and 9pm. Pick a time in that window.';
const NA_MOBILES_ONLY = 'Text messages can only go to Canadian and US mobile numbers for now.';
const now = () => new Date().toISOString();
export const COUNTS0 = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
export const IMG = 'https://127.0.0.1/nl-img/pwa-icon-512.png';
const EDITABLE = ['name', 'subject', 'preview_text', 'from_name', 'reply_to_email', 'channels', 'sms_text', 'template', 'header', 'blocks', 'audience', 'planned_send_at'];
// GET /user/profile's real keys: `phone` (not phone_number) and `avatar` (not profile_image); no profile_color.
const PROFILE = {
  name: 'Samantha Smith', email: 'samantha@serpachrysler.ca', phone: '+1 416 555 0100', avatar: null,
  website: 'https://serpachrysler.ca', instagram_url: 'https://instagram.com/serpachrysler', linkedin_url: '', tiktok_url: null,
  facebook_url: 'https://facebook.com/serpachrysler', is_business: 1,
};
const KINDS = ['campaign', 'product', 'vehicle'];
// PUT /newsletters/{id} rules, as NewsletterController::rules() and NewsletterContent::normalise*() answer them.
const HTTPS = /^https:\/\/[^\s<>"'\\]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function updateErrors(body) {
  const errors = {};
  if (body && 'name' in body && (typeof body.name !== 'string' || body.name.trim() === '')) errors.name = ['The name field is required.'];
  if (body?.reply_to_email != null && !EMAIL.test(String(body.reply_to_email))) errors.reply_to_email = ['Enter a reply-to email address like name@business.com.'];
  if (body?.template != null && body.template !== 'basic') errors.template = ['That template is coming soon. Use Basic for now.'];
  if (body?.planned_send_at != null && Number.isNaN(Date.parse(String(body.planned_send_at)))) errors.planned_send_at = ['Pick a date and time.'];
  for (const field of ['logo_url', 'banner_url']) {
    const v = body?.header?.[field];
    if (v != null && v !== '' && !HTTPS.test(v)) errors[`header.${field}`] = ['Use an image link that starts with https://'];
  }
  (Array.isArray(body?.blocks) ? body.blocks : []).forEach((b, i) => {
    const key = `blocks.${i}.data`;
    const bad = (v) => v != null && v !== '' && !HTTPS.test(v);
    if (b.type === 'image' && bad(b.data?.url)) errors[`${key}.url`] = ['Use an image link that starts with https://'];
    if (b.type === 'image' && bad(b.data?.link)) errors[`${key}.link`] = ['Use a link that starts with https://'];
    if (b.type === 'button' && bad(b.data?.url)) errors[`${key}.url`] = ['Use a link that starts with https://'];
    // Shared brief 2026-10-29: selections (kind + id) when present, else an older client's campaign_ids.
    const picks = b.type === 'campaigns' ? b.data?.selections : undefined;
    if (b.type === 'campaigns' && picks !== undefined) {
      if (!Array.isArray(picks) || picks.some((p) => !p || !KINDS.includes(p.kind) || !Number.isInteger(p.id))) errors[`${key}.selections`] = ['The campaigns, products or vehicles could not be read.'];
      else if (picks.length > 6) errors[`${key}.selections`] = ['A Campaigns section can show up to 6 campaigns, products or vehicles.'];
    } else if (b.type === 'campaigns' && (!Array.isArray(b.data?.campaign_ids) || b.data.campaign_ids.some((id) => !Number.isInteger(id)))) errors[`${key}.campaign_ids`] = ['The campaigns could not be read.'];
    else if (b.type === 'campaigns' && b.data.campaign_ids.length > 6) errors[`${key}.campaign_ids`] = ['A Campaigns section can show up to 6 campaigns.'];
    if (b.type === 'youtube' && bad(b.data?.url)) errors[`${key}.url`] = ['Use a YouTube link, like https://www.youtube.com/watch?v=…'];
    // Chris, 5 Nov: a Title or Text section's style (NewsletterContent::sectionStyle).
    if (b.type === 'title' || b.type === 'text') {
      const blank = (v) => v == null || v === '';
      if (!blank(b.data?.align) && !['left', 'center', 'right'].includes(b.data.align)) errors[`${key}.align`] = ['Choose left, centre or right.'];
      for (const f of ['color', 'background_color']) if (!blank(b.data?.[f]) && !/^#[0-9a-f]{6}$/i.test(b.data[f])) errors[`${key}.${f}`] = ['Pick a colour like #6C60FF.'];
      if (b.type === 'title' && bad(b.data?.background_image_url)) errors[`${key}.background_image_url`] = ['Use an image link that starts with https://'];
    }
    // Shared brief 2026-10-29 round 2: columns 1 | 2 (absent = 1).
    if (b.type === 'campaigns' && b.data?.columns != null && ![1, 2].includes(b.data.columns)) errors[`${key}.columns`] = ['Choose 1 or 2 columns.'];
    // Per-card edits: the contract's limits and messages.
    for (const o of b.type === 'campaigns' && b.data?.overrides && typeof b.data.overrides === 'object' ? Object.values(b.data.overrides) : []) {
      const long = (f, max) => typeof o?.[f] === 'string' && o[f].length > max;
      const message = long('title', 120) ? 'Keep the card title to 120 characters or fewer.'
        : long('description', 300) ? 'Keep the description to 300 characters or fewer.'
          : long('button_text', 30) ? 'Keep the button text to 30 characters or fewer.'
            : bad(o?.image_url) ? 'The card image must be an https link.' : null;
      if (message) { errors[`${key}.overrides`] = [message]; break; }
    }
  });
  return errors;
}
// Shared brief 2026-10-29 round 2: what the API keeps of a Campaigns section's layout (columns, absent = 1) and its
// per-card edits (only cards still picked, only the four fields, plain text: runs of spaces one space, trimmed;
// answered as {} when there are none).
const OVERRIDE_FIELDS = ['image_url', 'title', 'description', 'button_text'];
function campaignLayout(data, selections = []) {
  const keys = new Set(selections.map((p) => `${p.kind}:${p.id}`));
  const overrides = {};
  for (const [k, o] of Object.entries(data?.overrides && typeof data.overrides === 'object' ? data.overrides : {})) {
    if (!keys.has(k) || !o || typeof o !== 'object') continue;
    const kept = Object.fromEntries(OVERRIDE_FIELDS.filter((f) => typeof o[f] === 'string' && o[f].trim()).map((f) => [f, f === 'image_url' ? o[f].trim() : o[f].replace(/\s+/g, ' ').trim()]));
    if (Object.keys(kept).length) overrides[k] = kept;
  }
  return { ...([1, 2].includes(data?.columns) ? { columns: data.columns } : {}), overrides };
}
const MONTH_NAME = () => {
  const d = new Date();
  return `${d.toLocaleString('en-US', { month: 'long' })} Newsletter ${d.getFullYear()}`;
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pickEditable = (src) => Object.fromEntries(EDITABLE.filter((k) => src && k in src).map((k) => [k, structuredClone(src[k])]));

export function newsletter(id, over = {}) {
  return {
    id, name: null, subject: null, preview_text: null, from_name: null, reply_to_email: null, channels: ['email'], sms_text: null,
    template: 'basic', header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' },
    blocks: [], audience: [{ type: 'all_leads' }], status: 'draft', scheduled_at: null, planned_send_at: null, sent_at: null, failure_reason: null, public_url: null,
    counts: { ...COUNTS0 }, created_at: now(), updated_at: now(), ...over,
  };
}

// Per-channel results for the seeded sent newsletters. 24 went through the SendGrid fallback: no "delivered" (note 10).
const CHANNEL_COUNTS = {
  21: {
    email: { recipients: 1000, sent: 996, delivered: 980, opened: 470, clicked: 80, unsubscribed: 3, failed: 4, skipped: 10 },
    sms: { recipients: 204, sent: 202, delivered: 200, opened: 42, clicked: 8, unsubscribed: 1, failed: 2, skipped: 2 },
  },
  24: {
    email: { recipients: 300, sent: 300, delivered: 0, opened: 90, clicked: 12, unsubscribed: 1, failed: 0, skipped: 0 },
    sms: { ...COUNTS0 },
  },
  25: {
    email: { recipients: 700, sent: 320, delivered: 300, opened: 51, clicked: 7, unsubscribed: 0, failed: 2, skipped: 8 },
    sms: { recipients: 200, sent: 80, delivered: 78, opened: 9, clicked: 2, unsubscribed: 0, failed: 0, skipped: 1 },
  },
};

export function seedNewsletters() {
  const day = 24 * 3600 * 1000;
  return [
    newsletter(21, {
      name: 'September recap', subject: 'Thanks for a great September', status: 'sent', sent_at: '2026-10-01T14:00:00Z',
      public_url: 'https://127.0.0.1/n/abc123', blocks: [{ id: 'b1', type: 'title', data: { text: 'September', size: 'large' } }],
      counts: { recipients: 1204, sent: 1198, delivered: 1180, opened: 512, clicked: 88, unsubscribed: 4, failed: 6, skipped: 12 },
    }),
    newsletter(22, { name: 'Winter tires', subject: 'Book your winter tire swap', status: 'scheduled', scheduled_at: new Date(Date.now() + 2 * day).toISOString() }),
    newsletter(23, {
      name: 'October Newsletter 2026', subject: 'October deals are here', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca',
      blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }, { id: 'b2', type: 'text', data: { html: '<p>Hello <strong>there</strong></p>' } }],
    }),
    newsletter(24, {
      name: 'Service reminder', subject: 'Time for your fall service', status: 'sent', sent_at: '2026-09-15T14:00:00Z',
      blocks: [{ id: 'b1', type: 'title', data: { text: 'Fall service', size: 'large' } }],
      counts: { recipients: 300, sent: 300, delivered: 0, opened: 90, clicked: 12, unsubscribed: 1, failed: 0, skipped: 0 },
    }),
    newsletter(25, {
      name: 'Open house this weekend', subject: 'Come see the new Wagoneer', status: 'sending', channels: ['email', 'sms'], scheduled_at: new Date(Date.now() - 600000).toISOString(),
      blocks: [{ id: 'b1', type: 'title', data: { text: 'Open house', size: 'large' } }],
      counts: { recipients: 900, sent: 400, delivered: 378, opened: 60, clicked: 9, unsubscribed: 0, failed: 2, skipped: 9 },
    }),
  ];
}

// [wdy2xh2t3w] The owner's campaigns for a Campaigns section (GET /newsletters/campaign-options), newest first.
// shareable: it has a public page people can open from an email (the "Published Campaign … Live" link).
export const STUDIO = 'https://127.0.0.1/studio';
export function seedCampaigns(count = 9) {
  const titles = ['Fall service event', '2026 Grand Cherokee arrivals', 'Customer stories', 'Winter tire swap', 'Open house weekend',
    'Wagoneer launch night', 'Summer road trip tips', 'Meet the service team', 'Community car wash', 'Holiday hours', 'Spring clean-up', 'Ram truck month'];
  return Array.from({ length: count }, (_, i) => {
    const id = 601 + i;
    const draft = i === 2; // "Customer stories" isn't published yet
    const privateOne = i === 5; // published as Private (token only): no link people can open from an email
    return {
      id, title: titles[i % titles.length] + (i >= titles.length ? ` ${i + 1}` : ''),
      description: i === 0 ? 'Book your fall service before the snow arrives. Free multi-point inspection and a coffee on us while you wait — this week only at Serpa.' : `Photos and stories from ${titles[i % titles.length].toLowerCase()}.`,
      cover_url: i % 4 === 3 ? null : IMG,
      date: new Date(Date.UTC(2026, 9, 27 - i * 3)).toISOString().slice(0, 10),
      public_url: draft || privateOne ? null : `${STUDIO}/published-memory/campaign-${id}${i === 4 ? '?viewonly=1' : ''}`,
      shareable: !draft && !privateOne,
      reason: draft ? 'Publish it first to add it' : privateOne ? 'It is private. Make it public to add it' : null,
    };
  });
}

const BUTTON_LABEL = { campaign: 'View campaign', product: 'View product', vehicle: 'View vehicle' };

// Website Catalogue products as a Royalwood-like shop has them (catalog_items): newest first, some in each
// category, a few with no page of their own on the website (they can't be added).
export const ROYALWOOD = 'https://royalwood.example.ca';
export function seedProducts(count = 30) {
  const kinds = [
    ['Door Hardware', 'Brass lever handle'], ['Doors', 'Solid oak interior door'], ['Mouldings', 'Colonial baseboard 8 ft'],
    ['Stair Parts', 'Maple stair tread'], ['Door Hardware', 'Matte black hinge set'], ['Doors', 'Shaker pine closet door'],
  ];
  return Array.from({ length: count }, (_, i) => {
    const [category, name] = kinds[i % kinds.length];
    const noPage = i % 9 === 4; // e.g. a product only listed on a category page
    return {
      id: 881 + i, title: `${name}${i >= kinds.length ? ` ${i + 1}` : ''}`, category, brand: 'Royalwood', sku: `RW-${1000 + i}`,
      description: i === 0 ? 'Solid brass with a satin finish. Fits standard 2 3/8 in. backsets; screws included.' : `${name} from the Royalwood shop.`,
      cover_url: i % 5 === 2 ? null : IMG, date: new Date(Date.UTC(2026, 9, 28 - i)).toISOString().slice(0, 10),
      url: noPage ? null : `${ROYALWOOD}/products/rw-${1000 + i}`,
      // The API adds the currency when catalog_items.currency has one ("$129.99 CAD"); meta is "brand · category".
      price_text: i % 7 === 6 ? null : `$${(29 + i * 7.5).toFixed(2)}${i % 8 === 3 ? ' CAD' : ''}`, meta: `Royalwood · ${category}`.slice(0, 80),
    };
  });
}

// A dealer's vehicles (cars + car_images), newest first; the page is the vehicle's own listing on the website.
// category: cars.category as the inventory import stores it (lowercase).
export const DEALER = 'https://dealer.example.ca';
export function seedVehicles() {
  const cars = [
    ['2021 Jeep Grand Cherokee Limited', 'preowned', '$34,995', '2021 · 45,000 km · Automatic'],
    ['2023 Ram 1500 Big Horn', 'preowned', '$49,500', '2023 · 18,200 km · Automatic'],
    ['2024 Chrysler Pacifica Hybrid', 'hybrid', '$52,995', '2024 · 9,800 km · Automatic'],
    ['2022 Jeep Wrangler Sahara', 'preowned', null, '2022 · 30,500 km · Manual'],
  ];
  return cars.map(([title, category, price, meta], i) => {
    const [, make, ...model] = title.split(' ');
    return {
      id: 45 + i, title, category, make, model: model.join(' '), stock_number: `S${2300 + i}`,
      description: `${title}, one owner, clean history.`, cover_url: IMG,
      date: new Date(Date.UTC(2026, 9, 26 - i * 2)).toISOString().slice(0, 10),
      url: `${DEALER}/inventory/${45 + i}`, price_text: price, meta,
    };
  });
}

// "Single person" (Chris, 3 Nov 2026): the owner's leads GET /newsletters/lead-options lists, newest first, with the email
// and mobile a newsletter would use (NewsletterContacts: lower-case email, E.164 phone).
export function seedLeads() {
  return [
    { id: 7101, name: 'Jordan Price', email: 'jordan.price@example.com', phone: '+14165550171' },
    { id: 7102, name: 'Becky Lawson', email: 'becky@example.com', phone: null },
    { id: 7103, name: 'Marcus Chen', email: null, phone: '+19055550142' },
    { id: 7104, name: null, email: 'walkin.buyer@example.com', phone: null },
    { id: 7105, name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+16475550188' },
  ].map((l) => ({ unsubscribed: false, last_engaged_at: '2026-11-02T15:00:00Z', ...l }));
}

/**
 * The plan's next monthly reset (NewsletterAllowance resets_at), relative to today so the allowance checks never go
 * stale: the first of the month after the day after tomorrow, at `hourUtc` (4 = midnight in Toronto). A newsletter
 * scheduled for tomorrow is then always this month's.
 */
export function nextReset(hourUtc = 0) {
  const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, hourUtc)).toISOString().replace('.000Z', 'Z');
}
/** How Studio writes that date ("It resets on Dec 1."): formatResetDate, en-US, in UTC. */
export function resetLabel(iso = nextReset()) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

function previewHtml(n) {
  const blocks = (n.blocks || []).map((b) => {
    if (b.type === 'title') return `<h2>${esc(b.data.text)}</h2>`;
    if (b.type === 'text') return `<div>${esc(String(b.data.html).replace(/<[^>]+>/g, ''))}</div>`;
    if (b.type === 'campaigns') return (b.data.items || []).map((c) => `<div class="mock-campaign"><strong>${esc(c.title)}</strong>${c.price_text ? `<p><b>${esc(c.price_text)}</b></p>` : ''}${c.meta ? `<p style="color:#6b7280;font-size:13px">${esc(c.meta)}</p>` : ''}<p>${esc(c.description)}</p><a href="${esc(c.url)}">${BUTTON_LABEL[c.kind] || 'View campaign'}</a></div>`).join('');
    if (b.type === 'button') return `<p><a style="background:#6C60FF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none" href="#">${esc(b.data.label)}</a></p>`;
    return '';
  }).join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Arial,sans-serif"><table width="100%"><tr><td align="center">`
    + `<table width="100%" style="width:100%;max-width:600px;background:#fff"><tr><td style="background:${esc(n.header?.background_color || '#6C60FF')};color:#fff;padding:24px;text-align:center">`
    + `<h1 id="mock-preview-title">${esc(n.header?.title)}</h1></td></tr><tr><td style="padding:24px">${blocks}</td></tr>`
    + `<tr><td style="padding:16px;text-align:center;color:#888;font-size:12px">Powered by Stasht</td></tr></table></td></tr></table></body></html>`;
}

// NewsletterResultsController: 50 people a page; status filters on the row status, or on opened_at / clicked_at /
// unsubscribed_at for opened, clicked, unsubscribed; counts = totals + email + sms.
const RESULTS_PER_PAGE = 50;
function results(n, params, extra = {}) {
  const channels = extra[n.id] ?? CHANNEL_COUNTS[n.id];
  const all = [];
  const people = ['draft', 'scheduled'].includes(n.status) ? 0 : Math.min(n.counts.recipients, 120);
  const hasSms = (channels?.sms.recipients ?? 0) > 0;
  for (let i = 1; i <= people; i++) {
    const channel = hasSms && i % 3 === 0 ? 'sms' : 'email';
    const status = n.status === 'sending' && i > 30 ? 'queued' : i % 7 === 0 ? 'failed' : i % 5 === 0 ? 'skipped' : n.id === 24 ? 'sent' : 'delivered';
    const reached = status === 'delivered' || status === 'sent';
    all.push({
      name: i % 11 === 0 ? null : `Lead ${i}`, address: channel === 'sms' ? `+1416555${1000 + i}` : `lead${i}@example.com`, channel, status,
      sent_at: reached || status === 'failed' ? '2026-10-16T14:00:00Z' : null,
      opened_at: reached && i % 2 ? '2026-10-16T15:00:00Z' : null,
      clicked_at: reached && i % 4 === 1 ? '2026-10-16T15:05:00Z' : null,
      unsubscribed_at: i === 9 ? '2026-10-16T16:00:00Z' : null,
    });
  }
  const channel = params.get('channel');
  const status = params.get('status');
  const page = Number(params.get('page') || 1);
  const matches = (r) => !status
    || (status === 'opened' ? Boolean(r.opened_at) : status === 'clicked' ? Boolean(r.clicked_at) : status === 'unsubscribed' ? Boolean(r.unsubscribed_at) : r.status === status);
  const rows = all.filter((r) => (!channel || r.channel === channel) && matches(r));
  // Totals plus the same eight numbers per channel (contract note 2).
  const split = channels ?? { email: { ...n.counts }, sms: { ...COUNTS0 } };
  return {
    counts: { ...n.counts, email: split.email, sms: split.sms },
    recipients: {
      data: rows.slice((page - 1) * RESULTS_PER_PAGE, page * RESULTS_PER_PAGE),
      meta: { page, total_pages: Math.max(1, Math.ceil(rows.length / RESULTS_PER_PAGE)), total: rows.length },
    },
  };
}

export function createMockApi(options = {}) {
  const state = {
    plan: options.plan ?? 'Professional',
    nextId: 100,
    newsletters: options.newsletters ?? [],
    // default_message: "Set as my default message" (batch 3). defaultMessageColumn: false = an API before
    // docs/sql/2026-11-01-newsletter-default-message.sql ran (accepts the field, keeps nothing).
    // recent_colors (Chris, 6 Nov): NewsletterRecentColors; options.recentColors: false = an API without them (no key).
    brand: { header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' }, business_address: options.businessAddress ?? null, default_message: options.defaultMessage ?? null,
      ...(options.recentColors === false ? {} : { recent_colors: options.recentColors ?? [] }) },
    // ContactListController::summary: consent_type (null for lists made before consent was recorded) and created_at.
    lists: options.lists ?? [{ id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, consent_type: 'express', created_at: '2026-10-02T15:00:00Z' }],
    // AudienceResolver's skipped counts on top of the defaults (consent_expired, unsupported_number, ...).
    skipped: options.skipped ?? {},
    groups: options.groups ?? [{ id: 4, name: 'VIP buyers', member_count: 38, members: [], created_at: now(), updated_at: now() }],
    // The owner's leads for "Single person" (GET /newsletters/lead-options).
    leads: options.leads ?? seedLeads(),
    // Addresses that have unsubscribed (lower-case email, E.164 phone): a typed Single person is refused.
    unsubscribed: options.unsubscribed ?? [],
    // NewsletterAllowance::summary: *_pending = held back for newsletters sending or scheduled.
    allowance: options.allowance ?? { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 1200, sms_used: 40, email_pending: 0, sms_pending: 0, resets_at: nextReset() },
    sendErrors: options.sendErrors ?? null,
    // The signed-in owner (NewsletterController::store pre-fills from name and email). null email: the
    // account has none, so send needs a reply-to (422 reply_to_email).
    owner: { name: 'Samantha Smith', email: options.ownerEmail === undefined ? 'samantha@serpachrysler.ca' : options.ownerEmail },
    // Answer every PUT /newsletters/{id} with this status (500 = server down) while set.
    failPuts: options.failPuts ?? 0,
    // How many /user/storage-overview calls fail (500) before it answers: the plan check's "Try again".
    planFailures: options.planFailures ?? 0,
    // Image uploads answer after this many ms (to act while one is on its way).
    uploadDelayMs: options.uploadDelayMs ?? 0,
    // The link POST /newsletters/images answers with (default IMG); a scenario may change it between uploads.
    uploadUrl: options.uploadUrl ?? null,
    // Tests left this hour (NewsletterTestSendController's RateLimiter); then 429 with its own message.
    testsLeft: options.testsLeft ?? Infinity,
    // PUT fields to refuse with a 422 ({field: message}), as the API does for a value it won't take.
    rejectPut: options.rejectPut ?? {},
    // Send / schedule find the newsletter already scheduled (sent from another tab): 409, and it is no longer a draft.
    sendConflict: options.sendConflict ?? false,
    // Send / schedule answer 409 code stale (the draft changed while it was being sent).
    sendStale: options.sendStale ?? false,
    // Per-channel results counts by newsletter id, on top of the seeded ones.
    channelCounts: options.channelCounts ?? {},
    // Send / schedule answer as the API does while sending is switched off: 'all' (503 newsletters_paused, the
    // .env switch) or 'account' (409 newsletters_account_paused, one account held).
    sendPaused: options.sendPaused ?? null,
    // POST /newsletters/{id}/preview's size_kb (NewsletterSendCheck's rendered size), when set.
    previewSizeKb: options.previewSizeKb ?? null,
    // POST /newsletters/{id}/unschedule finds sending already started (409).
    unscheduleStarted: options.unscheduleStarted ?? false,
    // Files that reached POST /newsletters/images: {bytes, type, name}.
    uploads: [],
    // Storeels made with POST /memories, and saved campaigns GET /memories/{id} answers (the Storeel flow).
    storeels: [],
    memories: new Map(Object.entries(options.memories ?? {}).map(([id, m]) => [Number(id), structuredClone(m)])),
    // PUT /memories/{id} bodies, and the Storeel flow's send bodies (POST /memories/{id}/storeel-send).
    memoryPuts: [],
    storeelSends: [],
    // A moment's caption saved on a saved campaign (PUT /memory-images/{id}, multipart): {id, description}.
    imageUpdates: [],
    // The Storeel flow (Chris 4 Nov, point 9): 'not_available' = 503 before the server's SQL ran; putErrors /
    // storeelSendErrors = a 422 {field: message} for PUT /memories/{id} / storeel-send.
    storeelUnavailable: options.storeelUnavailable ?? false,
    putErrors: options.putErrors ?? null,
    storeelSendErrors: options.storeelSendErrors ?? null,
    // The owner's campaigns a Campaigns section can show.
    campaigns: options.campaigns ?? seedCampaigns(),
    // The owner's Website Catalogue products and dealer vehicles (shared brief 2026-10-29). None by default: an
    // account with campaigns only, as before.
    products: options.products ?? [],
    vehicles: options.vehicles ?? [],
    // What PUTs sent as each Campaigns section's data (to check Studio sends selections, never items).
    campaignBodies: [],
    // GET /newsletters/campaign-options answers after this many ms.
    optionsDelayMs: options.optionsDelayMs ?? 0,
    // The Leads page's tab-count sources (/leads, /lead-groups, /my-conversations, /contact-lists) answer this late.
    leadsDelayMs: options.leadsDelayMs ?? 0,
    // Results rows carry skip_reason / skip_note (Chris, 29 Oct round 2, item 6). Off by default.
    textSkips: options.textSkips ?? false,
    // Add / edit person answers a non-North-American mobile with the API's Canada/US message (item 8). Off by default.
    naMobilesOnly: options.naMobilesOnly ?? false,
    // People on each list (Lists tab), made from member_count the first time a list's people are asked for.
    members: new Map(),
    nextMemberId: 50000000,
    // GET /my-conversations rows (the Leads page's My Conversations tab and its unread badge).
    conversations: options.conversations ?? [],
    // newsletters.limits.import_rows: per request, and the most one list can hold.
    listCap: options.listCap ?? 10000,
    // CSV files GET /contact-lists/{id}/export answered: {listId, filename, body}.
    exports: [],
    calls: [],
  };
  const ok = (data, status = 200) => ({ status, json: { success: true, data } });
  const fail = (status, json) => ({ status, json });
  const find = (id) => state.newsletters.find((n) => n.id === id);
  const summary = ({ blocks, ...rest }) => rest;

  // campaign-options rows for one kind (only what can be listed: available products, vehicles still for sale).
  function optionsOf(kind) {
    if (kind === 'campaign') return state.campaigns.map((c) => ({ kind, ...c, price_text: null, meta: null, category: null, searchText: c.title.toLowerCase() }));
    const list = kind === 'product' ? state.products : state.vehicles;
    return list.filter((x) => x.available !== false).map((x) => {
      const url = /^https?:\/\//i.test(x.url || '') ? x.url : null;
      return {
        kind, id: x.id, title: x.title, description: x.description ?? null, cover_url: x.cover_url ?? null, date: x.date ?? null,
        public_url: url, shareable: Boolean(url), reason: url ? null : 'This item has no web page',
        price_text: x.price_text ?? null, meta: x.meta ?? null, category: x.category ?? null,
        searchText: [x.title, x.sku, x.brand, x.make, x.model, x.stock_number].filter(Boolean).join(' ').toLowerCase(),
      };
    });
  }
  // NewsletterCampaigns: the card for one pick, or null when it can't be shown (dropped from the snapshot).
  function snapshotItem(kind, id) {
    const o = KINDS.includes(kind) ? optionsOf(kind).find((x) => x.id === id) : null;
    if (!o || !o.shareable) return null;
    return {
      kind, id, title: o.title, description: String(o.description ?? '').slice(0, 160), cover_url: o.cover_url, url: o.public_url,
      date: o.date, price_text: o.price_text, meta: o.meta,
    };
  }

  function audienceCount(audience, channels) {
    let email = 0;
    let sms = 0;
    let noEmail = 0;
    let noPhone = 0;
    let unsubscribed = 0;
    let unsupported = 0;
    let person = null;
    for (const a of audience || []) {
      if (a.type === 'lead') {
        const l = state.leads.find((x) => x.id === a.id);
        if (l?.email) email += 1; else if (l) noEmail += 1;
        if (l?.phone) sms += 1; else if (l) noPhone += 1;
      }
      // One person typed in (NewsletterPerson): their addresses for the chosen channels; an unsubscribed one (a
      // suppression, or an opted-out lead) is left out and said so in `person`; texts only to +1 numbers.
      if (a.type === 'person') {
        person = {};
        if (channels.includes('email')) {
          const to = String(a.email ?? '').trim().toLowerCase();
          if (!to) { noEmail += 1; person.email = 'no_email'; }
          else if (state.unsubscribed.includes(to)) { unsubscribed += 1; person.email = 'unsubscribed'; }
          else { email += 1; person.email = null; }
        }
        if (channels.includes('sms')) {
          const to = String(a.phone ?? '');
          if (!to) { noPhone += 1; person.sms = 'no_phone'; }
          else if (state.unsubscribed.includes(to)) { unsubscribed += 1; person.sms = 'unsubscribed'; }
          else if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(to)) { unsupported += 1; person.sms = 'unsupported_number'; }
          else { sms += 1; person.sms = null; }
        }
        // NewsletterPerson::problems: what would stop Send, by box, in the API's words.
        const typedEmail = channels.includes('email') ? String(a.email ?? '').trim().toLowerCase() : '';
        const typedPhone = channels.includes('sms') ? String(a.phone ?? '') : '';
        const byEmail = typedEmail ? state.leads.find((l) => l.email === typedEmail) : null;
        const byPhone = typedPhone ? state.leads.find((l) => l.phone === typedPhone) : null;
        const errors = {};
        if (byEmail && byPhone && byEmail.id !== byPhone.id) errors.phone = 'That email and phone belong to two different leads — use one.';
        else {
          if (person.email === 'unsubscribed') errors.email = "This email address has unsubscribed, so it can't get your newsletters.";
          if (person.sms === 'unsubscribed') errors.phone = "This phone number has unsubscribed, so it can't get your texts.";
        }
        person.errors = errors;
      }
      if (a.type === 'all_leads') { email += 1180; sms += 310; }
      if (a.type === 'lead_group') { email += 36; sms += 30; }
      if (a.type === 'list') { const l = state.lists.find((x) => x.id === a.id); if (l) { email += l.email_count; sms += l.sms_count; } }
    }
    const onePerson = (audience || []).length > 0 && audience.every((a) => a.type === 'lead' || a.type === 'person');
    return {
      email: channels.includes('email') ? email : 0, sms: channels.includes('sms') ? sms : 0,
      skipped: onePerson
        ? { no_email: channels.includes('email') ? noEmail : 0, no_phone: channels.includes('sms') ? noPhone : 0, unsubscribed, duplicate: 0, unsupported_number: unsupported, consent_expired: 0 }
        : { no_email: 24, no_phone: 0, unsubscribed: 3, duplicate: 11, unsupported_number: 0, consent_expired: 0, ...state.skipped },
      ...(person && audience.length === 1 ? { person } : {}),
    };
  }

  // NewsletterSendCheck::assertReady (plus the reply-to rule for an account with no email).
  function sendErrors(n) {
    if (state.sendErrors) return state.sendErrors;
    const errors = {};
    const channels = (n.channels || []).filter((c) => c === 'email' || c === 'sms');
    if (!String(n.subject ?? '').trim()) errors.subject = ['Add a subject line.'];
    // PUT keeps unfinished sections; send names the first one (contract note 6).
    const missing = (n.blocks || []).flatMap((b, i) => {
      if (b.type === 'image' && !b.data?.url) return [`Section ${i + 1} (Image) needs a picture.`];
      if (b.type === 'campaigns' && !(b.data?.selections ?? b.data?.campaign_ids)?.length) return [`Section ${i + 1} (Campaigns) needs at least one campaign, product or vehicle.`];
      return [];
    });
    if (!n.blocks?.length) errors.blocks = ['Add at least one section to your newsletter.'];
    else if (missing.length) errors.blocks = [missing[0]];
    if (!channels.length) errors.channels = ['Choose email, text message or both.'];
    if (channels.includes('sms') && !String(n.sms_text ?? '').trim()) errors.sms_text = ['Write the text message people will get.'];
    // NewsletterSendCheck::smsTooLong, with the From name queue() fills in.
    else if (channels.includes('sms') && smsPartsInfo(n.from_name || state.owner.name || 'Stasht', n.sms_text).problem) errors.sms_text = [smsPartsInfo(n.from_name || state.owner.name || 'Stasht', n.sms_text).problem];
    if (!String(state.brand.business_address ?? '').trim()) errors.business_address = ['Add your business address. It is shown at the bottom of every newsletter.'];
    if (channels.length) {
      const c = audienceCount(n.audience, channels);
      // NewsletterSendCheck::personProblems: a typed person who can't be sent to is refused by name of the box.
      const i = (n.audience || []).findIndex((a) => a.type === 'person');
      for (const [box, message] of Object.entries(c.person?.errors ?? {})) errors[`audience.${i}.${box}`] = [message];
      if (!Object.keys(errors).some((k) => k.startsWith('audience.')) && channels.reduce((sum, ch) => sum + c[ch], 0) === 0) errors.audience = ['No one on your recipient lists can be reached by the channels you chose.'];
    }
    if (channels.includes('email') && !n.reply_to_email && !state.owner.email) errors.reply_to_email = ['Add a reply-to email so people can answer you.'];
    return errors;
  }

  // ── Lists tab (shared brief 2026-10-28) ────────────────────────────────────────────────────────────────────
  // Contact 1 has the highest id, so newest first (id desc) still starts with Contact 1, as before.
  function membersOf(list) {
    if (!state.members.has(list.id)) {
      const total = list.member_count;
      const rows = [];
      for (let i = 1; i <= total; i++) {
        const email = i % 4 === 0 ? null : `contact${i}@example.com`;
        // Everyone on a list has an email address or a mobile number (the API never keeps anyone with neither).
        const phone = i % 3 === 0 || !email ? `+1416555${String(1000 + i).slice(-4)}` : null;
        rows.push({
          id: list.id * 100000 + (total - i + 1),
          name: i % 9 === 0 ? null : `Contact ${i}`, email, phone,
          email_status: email ? (i % 17 === 0 ? 'unsubscribed' : i % 29 === 0 ? 'bounced' : 'subscribed') : null,
          sms_status: phone ? (i % 15 === 0 ? 'stopped' : 'subscribed') : null,
          consent_type: list.consent_type ?? null, consent_source: list.consent_type ? (list.source === 'import' ? 'import' : 'lead') : null,
          consent_at: list.consent_type ? '2026-05-01T04:00:00Z' : null,
          added_at: list.created_at ?? '2026-10-01T15:00:00Z',
        });
      }
      state.members.set(list.id, rows);
    }
    return state.members.get(list.id);
  }
  const unsubscribed = (m) => (m.email_status && m.email_status !== 'subscribed') || m.sms_status === 'stopped';
  function recount(list) {
    const rows = membersOf(list);
    Object.assign(list, {
      member_count: rows.length, email_count: rows.filter((m) => m.email).length, sms_count: rows.filter((m) => m.phone).length,
      unsubscribed_count: rows.filter(unsubscribed).length, updated_at: now(),
    });
    return list;
  }
  const digits = (v) => String(v ?? '').replace(/\D/g, '');
  const normEmail = (v) => { const e = String(v ?? '').trim().toLowerCase(); return EMAIL.test(e) ? e : null; };
  // NewsletterContacts::phone: Canadian and US mobile numbers only (+1 and ten digits); anything else is not kept.
  const normPhone = (v) => {
    const t = String(v ?? '').trim();
    if (!t || /[a-z@]/i.test(t)) return null;
    const d = digits(t);
    if (d.length === 10) return `+1${d}`;
    return d.length === 11 && d.startsWith('1') ? `+${d}` : null;
  };
  const samePhone = (a, b) => Boolean(a && b && digits(a) === digits(b));
  const memberRow = (m) => ({ ...m });
  // ContactListBuilder::merge into an existing list: a match by email or phone only fills what is missing.
  // Import: skipped = rows with nothing usable + duplicates in the file; unchanged = a match with nothing to fill.
  // Copy: skipped = people already on the target with nothing to fill.
  function mergeInto(list, rows, consent, mode = 'import') {
    const members = membersOf(list);
    const seen = new Set();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let unchanged = 0;
    const fresh = [];
    for (const r of rows) {
      const email = normEmail(r.email);
      const phone = normPhone(r.phone);
      if (!email && !phone) { skipped++; continue; }
      if ((email && seen.has(`e:${email}`)) || (phone && seen.has(`p:${digits(phone)}`))) { skipped++; continue; }
      if (email) seen.add(`e:${email}`);
      if (phone) seen.add(`p:${digits(phone)}`);
      const match = members.find((m) => (email && m.email === email) || (phone && samePhone(m.phone, phone)));
      if (match) {
        let filled = false;
        if (!match.name && r.name) { match.name = String(r.name).trim(); filled = true; }
        if (!match.email && email) { match.email = email; match.email_status = 'subscribed'; filled = true; }
        if (!match.phone && phone) { match.phone = phone; match.sms_status = 'subscribed'; filled = true; }
        if (filled) updated++;
        else if (mode === 'copy') skipped++;
        else unchanged++;
        continue;
      }
      fresh.push({
        id: state.nextMemberId++, name: r.name ? String(r.name).trim() : null, email, phone,
        email_status: email ? 'subscribed' : null, sms_status: phone ? 'subscribed' : null,
        consent_type: consent.consent_type ?? r.consent_type ?? null, consent_source: consent.consent_source ?? r.consent_source ?? null,
        consent_at: r.consent_at ?? now(), added_at: now(),
      });
      added++;
    }
    if (members.length + fresh.length > state.listCap) return { error: `This list can hold up to ${state.listCap.toLocaleString('en-US')} people.` };
    members.push(...fresh);
    recount(list);
    return mode === 'copy' ? { added, updated, skipped, list } : { added, updated, skipped, unchanged, list };
  }
  const tooMany = (msg, field = 'rows') => fail(422, { message: msg, errors: { [field]: [msg] } });
  function idsError(ids) {
    if (!ids.length) return tooMany('Choose at least one person.', 'ids');
    if (ids.length > 500) return tooMany('Choose up to 500 people at a time.', 'ids');
    return null;
  }
  function membersPage(list, params) {
    const rows = [...membersOf(list)].sort((a, b) => b.id - a.id);
    const q = String(params.get('search') || '').trim().toLowerCase();
    const qd = digits(q);
    const status = params.get('status') || 'all';
    const counts = { all: rows.length, subscribed: rows.filter((m) => !unsubscribed(m)).length, unsubscribed: rows.filter(unsubscribed).length };
    const hits = rows.filter((m) => {
      if (status === 'subscribed' && unsubscribed(m)) return false;
      if (status === 'unsubscribed' && !unsubscribed(m)) return false;
      if (!q) return true;
      return [m.name, m.email, m.phone].some((v) => v && v.toLowerCase().includes(q)) || (qd.length >= 3 && m.phone && digits(m.phone).includes(qd));
    });
    const page = Math.max(1, Number(params.get('page') || 1));
    return { data: hits.slice((page - 1) * 50, page * 50).map(memberRow), meta: { page, total_pages: Math.max(1, Math.ceil(hits.length / 50)), total: hits.length, counts } };
  }
  const NOT_FOUND = () => fail(404, { success: false, message: 'List not found' });
  const csvCell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

  function listsTab(method, path, params, body) {
    if (path === '/contact-lists' && method === 'POST') {
      const name = String(body?.name ?? '').trim();
      if (!name) return fail(422, { message: 'Give the list a name.', errors: { name: ['Give the list a name.'] } });
      if (name.length > 120) return fail(422, { message: 'Keep the list name to 120 characters or fewer.', errors: { name: ['Keep the list name to 120 characters or fewer.'] } });
      const list = { id: state.nextId++, name, source: 'manual', member_count: 0, email_count: 0, sms_count: 0, unsubscribed_count: 0, consent_type: null, created_at: now(), updated_at: now() };
      state.lists.unshift(list);
      state.members.set(list.id, []);
      return ok(list, 201);
    }
    const m = path.match(/^\/contact-lists\/(\d+)\/(members\/remove|members\/copy|members\/(\d+)|members|import|duplicate|export)$/);
    if (!m) return null;
    const list = state.lists.find((l) => l.id === Number(m[1]));
    if (!list) return NOT_FOUND();
    const action = m[2];
    if (action === 'members' && method === 'GET') return ok(membersPage(list, params));
    if (action === 'members' && method === 'POST') {
      const errors = {};
      const rawEmail = String(body?.email ?? '').trim();
      const rawPhone = String(body?.phone ?? '').trim();
      const email = normEmail(rawEmail);
      const phone = normPhone(rawPhone);
      if (!rawEmail && !rawPhone) errors.email = ['Add an email address or a mobile number.'];
      else if (rawEmail && !email) errors.email = ['Enter an email address like name@example.com.'];
      if (rawPhone && !phone) errors.phone = ['Enter a mobile number with its country code, like +1 416 555 0100.'];
      // Chris, 29 Oct (round 2), item 8: the API's words for a number outside Canada and the US (naMobilesOnly).
      if (state.naMobilesOnly && errors.phone) errors.phone = [NA_MOBILES_ONLY];
      if (!['express', 'implied'].includes(body?.consent_type)) errors.consent_type = ['Choose how this person agreed to hear from you.'];
      if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
      const rows = membersOf(list);
      if (rows.some((r) => (email && r.email === email) || (phone && samePhone(r.phone, phone)))) {
        return fail(409, { success: false, message: 'This person is already on this list.' });
      }
      const row = {
        id: state.nextMemberId++, name: String(body?.name ?? '').trim() || null, email, phone,
        email_status: email ? 'subscribed' : null, sms_status: phone ? 'subscribed' : null,
        consent_type: body.consent_type, consent_source: body.consent_source ?? null, consent_at: now(), added_at: now(),
      };
      rows.push(row);
      recount(list);
      return ok(memberRow(row), 201);
    }
    if (m[3] && method === 'PATCH') {
      const rows = membersOf(list);
      const row = rows.find((r) => r.id === Number(m[3]));
      if (!row) return fail(404, { success: false, message: 'Person not found' });
      const next = { ...row };
      const errors = {};
      if (body && 'name' in body) next.name = String(body.name ?? '').trim() || null;
      if (body && 'email' in body) {
        const raw = String(body.email ?? '').trim();
        next.email = raw ? normEmail(raw) : null;
        if (raw && !next.email) errors.email = ['Enter an email address like name@example.com.'];
      }
      if (body && 'phone' in body) {
        const raw = String(body.phone ?? '').trim();
        next.phone = raw ? normPhone(raw) : null;
        if (raw && !next.phone) errors.phone = ['Enter a mobile number with its country code, like +1 416 555 0100.'];
        if (state.naMobilesOnly && errors.phone) errors.phone = [NA_MOBILES_ONLY];
      }
      if (!errors.email && !errors.phone && !next.email && !next.phone) errors.email = ['Add an email address or a mobile number.'];
      if (!errors.email && next.email && rows.some((r) => r !== row && r.email === next.email)) errors.email = ['Someone on this list already has this email address.'];
      if (!errors.phone && next.phone && rows.some((r) => r !== row && samePhone(r.phone, next.phone))) errors.phone = ['Someone on this list already has this mobile number.'];
      if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
      if (next.email !== row.email) next.email_status = next.email ? 'subscribed' : null;
      if (next.phone !== row.phone) next.sms_status = next.phone ? 'subscribed' : null;
      Object.assign(row, next);
      recount(list);
      return ok(memberRow(row));
    }
    if (action === 'members/remove' && method === 'POST') {
      const ids = Array.isArray(body?.ids) ? body.ids : [];
      if (idsError(ids)) return idsError(ids);
      const rows = membersOf(list);
      const keep = rows.filter((r) => !ids.includes(r.id));
      const removed = rows.length - keep.length;
      state.members.set(list.id, keep);
      recount(list);
      return ok({ removed, list });
    }
    if (action === 'members/copy' && method === 'POST') {
      const ids = Array.isArray(body?.ids) ? body.ids : [];
      if (idsError(ids)) return idsError(ids);
      if (body?.target_list_id == null) return tooMany('Choose a list to copy these people to.', 'target_list_id');
      if (body?.target_list_id === list.id) return fail(422, { message: 'Choose a different list.', errors: { target_list_id: ['Choose a different list.'] } });
      const target = state.lists.find((l) => l.id === body?.target_list_id);
      if (!target) return NOT_FOUND();
      const people = membersOf(list).filter((r) => ids.includes(r.id));
      const r = mergeInto(target, people, {}, 'copy');
      if (r.error) return tooMany(r.error, 'ids');
      return ok(r);
    }
    if (action === 'import' && method === 'POST') {
      const errors = {};
      if (body?.consent !== true) errors.consent = ['Confirm these people agreed to hear from you.'];
      if (!['express', 'implied'].includes(body?.consent_type)) errors.consent_type = ['Choose how these people agreed to hear from you.'];
      if (!Array.isArray(body?.rows) || !body.rows.length) errors.rows = ['The file has no rows.'];
      else if (body.rows.length > 10000) errors.rows = ['You can import up to 10,000 people at a time.'];
      if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
      const r = mergeInto(list, body.rows, { consent_type: body.consent_type, consent_source: body.consent_source ?? null });
      if (r.error) return tooMany(r.error);
      return ok(r);
    }
    if (action === 'duplicate' && method === 'POST') {
      const name = (String(body?.name ?? '').trim() || `${list.name} (copy)`).slice(0, 120);
      const copy = { ...list, id: state.nextId++, name, created_at: now(), updated_at: now() };
      state.members.set(copy.id, membersOf(list).map((r) => ({ ...r, id: state.nextMemberId++ })));
      recount(copy);
      state.lists.unshift(copy);
      return ok(copy, 201);
    }
    if (action === 'export' && method === 'GET') {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${list.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}.csv`;
      const lines = [['Name', 'Email', 'Mobile', 'Email status', 'Text status', 'Consent', 'Consent note', 'Consent date', 'Added']];
      // Statuses capitalised, dates as Y-m-d H:i in America/Toronto (the API's export).
      const cap = (v) => (v ? v[0].toUpperCase() + v.slice(1) : '');
      const when = (iso) => (iso ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '');
      for (const r of [...membersOf(list)].sort((a, b) => b.id - a.id)) {
        lines.push([r.name, r.email, r.phone, cap(r.email_status), cap(r.sms_status), cap(r.consent_type), r.consent_source, when(r.consent_at), when(r.added_at)]);
      }
      const csv = `\uFEFF${lines.map((l) => l.map(csvCell).join(',')).join('\r\n')}\r\n`;
      state.exports.push({ listId: list.id, filename, body: csv });
      return { status: 200, raw: csv, headers: { 'Content-Type': 'text/csv; charset=UTF-8', 'Content-Disposition': `attachment; filename="${filename}"` } };
    }
    return null;
  }

  function handle(method, path, params, body) {
    if (path === '/user/storage-overview') {
      if (state.planFailures > 0) {
        state.planFailures -= 1;
        return fail(500, { success: false, message: 'Server error' });
      }
      return ok({ storage_overview: { plan_name: state.plan } });
    }
    if (path === '/user/profile') return ok({ user: PROFILE });
    // options.catalogue: the account has Website Catalogue items (Create Campaign then offers its "Website Catalogue").
    // options.cataloguePlanRequired: the account is in the catalogue pilot but not on the Business plan (Chris 7 Nov).
    if (path === '/website-catalogue') {
      if (options.cataloguePlanRequired) return ok({ available: false, reason: 'plan_required', item_count: 2 });
      return ok(options.catalogue ? { available: true, reason: null, item_count: 2 } : { available: false, reason: 'not_available', item_count: 0 });
    }
    // CampaignMomentsController (Chris, 7 Nov 2026): a saved campaign's products, vehicles and moment order.
    const momentsMatch = /^\/memories\/(\d+)\/(catalogue-items|cars|moment-order)(?:\/(\d+))?$/.exec(path);
    if (momentsMatch) {
      const id = Number(momentsMatch[1]);
      const m = state.memories.get(id);
      state.momentCalls = [...(state.momentCalls ?? []), { method, kind: momentsMatch[2], id, body, sub: momentsMatch[3] ?? null }];
      if (!m) return fail(404, { success: false, message: 'Campaign not found.' });
      const orderOf = () => (Array.isArray(m.unified_order) && m.unified_order.length ? m.unified_order : [
        ...(m.posts ?? []).filter((p) => p.parent_id == null).map((p) => ({ type: 'post', id: p.id })),
        ...(m.linked_memories ?? []).filter((l) => !l.is_car).map((l) => ({ type: 'linked_memory', id: l.id })),
      ]);
      if (momentsMatch[2] === 'moment-order' && method === 'PUT') {
        m.unified_order = body.order.map((o) => ({ type: o.type, id: Number(o.id) }));
        return ok({ order: m.unified_order });
      }
      if (momentsMatch[2] === 'catalogue-items' && method === 'POST') {
        if (options.cataloguePlanRequired) return fail(403, { success: false, code: 'plan_required', message: 'Website Catalogue campaigns are available on the Business plan.' });
        const order = orderOf();
        const made = (body.catalog_item_ids ?? []).map((itemId, i) => ({
          id: id * 1000 + 500 + (m.posts?.length ?? 0) + i, parent_id: null, image_link: IMG, title: itemId === 61 ? 'Oak bench' : 'Pine shelf', description: 'Price: $450',
        }));
        m.posts = [...(m.posts ?? []), ...made];
        const at = body.after_item_id ? order.findIndex((o) => o.type === body.after_item_type && Number(o.id) === Number(body.after_item_id)) + 1
          : body.position === 'start' ? 0 : order.length;
        order.splice(at > 0 || body.position === 'start' ? at : order.length, 0, ...made.map((p) => ({ type: 'post', id: p.id })));
        m.unified_order = order;
        return ok({ moments: made.length, skipped_item_ids: [], already_added_item_ids: [], moment_ids: made.map((p) => p.id) });
      }
      if (momentsMatch[2] === 'cars' && method === 'POST') {
        const before = (m.linked_memories ?? []).length;
        for (const carId of body.car_ids ?? []) {
          if (!(m.linked_memories ?? []).some((l) => l.is_car && Number(l.id) === Number(carId))) m.linked_memories = [...(m.linked_memories ?? []), { id: Number(carId), is_car: 1, title: '2024 Jeep Wrangler', price: '34995', mileage: 45000, stock_number: 'S2300' }];
        }
        return ok({ linked: (m.linked_memories ?? []).length - before });
      }
      if (momentsMatch[2] === 'cars' && method === 'DELETE') {
        m.linked_memories = (m.linked_memories ?? []).filter((l) => !(l.is_car && Number(l.id) === Number(momentsMatch[3])));
        return ok({});
      }
    }
    // The campaign page's moment delete (dashboardAPI.deletePost) on a saved Storeel.
    const postDelete = /^\/memory-images\/(\d+)$/.exec(path);
    if (postDelete && method === 'DELETE') {
      const postId = Number(postDelete[1]);
      for (const m of state.memories.values()) {
        m.posts = (m.posts ?? []).filter((p) => p.id !== postId);
        if (Array.isArray(m.unified_order)) m.unified_order = m.unified_order.filter((o) => !(o.type === 'post' && Number(o.id) === postId));
      }
      state.deletedPosts = [...(state.deletedPosts ?? []), postId];
      return ok({});
    }
    if (path === '/website-catalogue/items' && options.catalogue) {
      // The Storeel flow's live preview shows a picked item as a product moment (its photo, price, "View on website").
      return ok({ items: [
        { id: 61, title: 'Oak bench', price_label: '$450', category: 'Benches', main_image: IMG, images_count: 2, url: 'https://royalwood.example.ca/products/oak-bench' },
        { id: 62, title: 'Pine shelf', price_label: '$120', category: 'Shelves', main_image: null, images_count: 1, url: null },
      ], pagination: { last_page: 1 } });
    }
    // options.cars: the dealer has listings (Create Campaign then offers "Cars").
    if (path === '/cars' && method === 'GET') {
      return ok({ cars: options.cars ? [{ id: 5, title: '2024 Jeep Wrangler', main_image: IMG, images_count: 6, price: '34995', mileage: 45000, stock_number: 'S2300' }] : [], pagination: { last_page: 1 }, filters: {} });
    }
    if (path === '/user/check-memory-limit') {
      return ok({ limit_status: { status: options.storeelLimit ? 'limit_exceeded' : 'within_limit', current_memories: options.storeelLimit ? 5 : 2, memory_limit: 5, ai_connects: 120 } });
    }
    // The Storeel form: its categories, and POST /memories (MemoryController::store) to create a Storeel.
    if (path === '/memories/categories-labels') {
      return ok({ categories: [{ id: 7, name: 'Personal', is_owner: true, can_add_story: true }, { id: 8, name: 'Service', is_owner: true, can_add_story: true }], labels: [] });
    }
    // The web API's own Storeel limit check (MemoryController), which can say no although check-memory-limit
    // just said yes (another tab or device made one meanwhile).
    if (options.storeelServerLimit && method === 'POST' && (path === '/memories' || path === '/memories/create-with-images')) {
      return fail(403, { success: false, code: 'memory_limit_reached', message: "You've reached your plan's campaign limit. Upgrade your plan to create more campaigns." });
    }
    // Add a Moment's photo upload (dashboardAPI.uploadImageWithMetadata): the uploaded file's link.
    if (path === '/user/upload-image-with-metadata' && method === 'POST') return ok({ fileUrl: IMG, imageName: 'scan.png' });
    if (path === '/memories' && method === 'POST') {
      // MemoriesController::store answers {id, title, slug, category_id, …}.
      const id = state.nextId++;
      const slug = `${String(body?.title ?? 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id}`;
      const memory = { id, slug, published: 0, ...body };
      state.storeels.push(memory);
      state.memories.set(id, {
        id, slug, title: body?.title, published: Number(body?.published) || 0, is_car: 0, user_id: 990002,
        category: { id: body?.category_id, name: body?.category_id === 8 ? 'Service' : 'Personal' }, sub_category: body?.sub_category?.[0] ? { name: body.sub_category[0] } : null,
        min_uploaded_img_date: null, max_uploaded_img_date: null, location: body?.location ?? '', tags: body?.tags ?? [], last_update_img: body?.last_update_img ?? null,
        // A catalogue item becomes a moment (CatalogSnapshotWriter), a picked vehicle a linked campaign (memory_cars).
        posts: [
          ...(body?.catalog_item_ids ?? []).map((itemId) => ({ title: itemId === 61 ? 'Oak bench' : 'Pine shelf', description: 'Price: $450', image_link: IMG })),
          ...(body?.photos ?? []).map((p) => ({ title: p.title ?? '', description: p.description ?? '', image_link: p.fileUrl ?? IMG })),
        ].map((p, i) => ({ id: id * 100 + i, parent_id: null, ...p })),
        // Add a Moment's vehicles on another category come as linked_memory_ids (store() links a vehicle id it finds there).
        linked_memories: [...(body?.car_ids ?? []), ...(body?.linked_memory_ids ?? []).filter((v) => Number(v) === 5)].map((carId) => ({ id: Number(carId), is_car: 1, title: '2024 Jeep Wrangler', price: '34995', mileage: 45000, stock_number: 'S2300' })),
      });
      return ok({ id, title: body?.title, slug, category_id: body?.category_id, sub_category_id: null, collaborators_count: 0, created_at: now() }, 201);
    }
    // The Media Library (Add a Moment's "Add from Media Library": MediaLibrarySelectionModal reads unassigned_media).
    if (path === '/memory-images' && method === 'GET') {
      return { status: 200, json: { unassigned_media: [{ media_id: 501, media_url: IMG, name: 'library-porch.png', media_size: '0.2', capture_date: '2026-10-20' }] } };
    }
    // The Storeel flow on a saved campaign: GET (Edit, back from the campaign page) and PUT (Set up saved).
    const memoryMatch = /^\/memories\/(\d+)$/.exec(path);
    if (memoryMatch && method === 'GET') {
      const m = state.memories.get(Number(memoryMatch[1]));
      return m ? { status: 200, json: { status: 'success', data: { memory: m, ...(m.unified_order ? { unified_order: m.unified_order } : {}), ...(m.linked_memories ? { linked_memories: m.linked_memories } : {}) } } } : fail(404, { success: false, message: 'Memory not found' });
    }
    if (memoryMatch && method === 'PUT') {
      const id = Number(memoryMatch[1]);
      state.memoryPuts.push({ id, body });
      if (body && 'category_id' in body && body.category_id !== 'shopify' && !/^\d+$/.test(String(body.category_id))) {
        return fail(422, { message: 'The category id must be an integer or "shopify".', errors: { category_id: ['The category id must be an integer or "shopify".'] } });
      }
      if (state.putErrors) return fail(422, { message: Object.values(state.putErrors)[0], errors: Object.fromEntries(Object.entries(state.putErrors).map(([k, v]) => [k, [v]])) });
      const m = state.memories.get(id);
      if (m) Object.assign(m, { title: body?.title ?? m.title, location: body?.location ?? m.location, tags: body?.tags ?? m.tags, ...('last_update_img' in (body ?? {}) ? { last_update_img: body.last_update_img } : {}) });
      return ok(m ?? { id });
    }
    // StoreelBroadcastController (the Storeel flow's step 3 Send).
    const storeelMatch = /^\/memories\/(\d+)\/(storeel-audience-count|storeel-send)$/.exec(path);
    if (storeelMatch && method === 'POST') {
      if (state.storeelUnavailable) return fail(503, { success: false, code: 'not_available', message: 'Sending Storeels to lists is not available yet.' });
      // CampaignPublishAccess: a collaborator / a campaign only shared with the property may not count or send.
      if (options.storeelForbidden) return fail(403, { success: false, message: 'You can’t send this campaign.' });
      const channels = (body?.channels || []).filter((c) => c === 'email' || c === 'sms');
      const c = audienceCount(body?.audience, channels);
      const needed = (channels.includes('email') ? c.email : 0) + (channels.includes('sms') ? c.sms : 0);
      if (storeelMatch[2] === 'storeel-audience-count') {
        return { status: 200, json: { success: true, data: c, storeel: { max_messages: 1000, needed, over_limit: needed > 1000, sms: null, allowance: state.allowance } } };
      }
      state.storeelSends.push({ id: Number(storeelMatch[1]), body });
      if (state.storeelSendErrors) {
        return fail(422, { message: Object.values(state.storeelSendErrors)[0], errors: Object.fromEntries(Object.entries(state.storeelSendErrors).map(([k, v]) => [k, [v]])) });
      }
      const m = state.memories.get(Number(storeelMatch[1]));
      const publishedNow = Boolean(m && !m.published);
      if (m && !m.published) m.published = 1;
      const email = channels.includes('email') ? c.email : 0;
      const sms = channels.includes('sms') ? c.sms : 0;
      const small = email + sms <= 20;
      return ok({
        broadcast_id: `b-${state.storeelSends.length}`, memory_id: Number(storeelMatch[1]), status: small ? 'sent' : 'sending', channels, subject: m?.title ?? '',
        replayed: false, published_now: publishedNow, texts_wait_until: null, created_at: now(), finished_at: small ? now() : null,
        counts: {
          recipients: email + sms, sent: small ? email + sms : 0, queued: small ? 0 : email + sms, failed: 0,
          email: { sent: small ? email : 0, queued: small ? 0 : email, failed: 0 }, sms: { sent: small ? sms : 0, queued: small ? 0 : sms, failed: 0 },
          skipped: { ...c.skipped, total: Object.values(c.skipped).reduce((a, b) => a + (Number(b) || 0), 0) },
        },
      });
    }
    // LeadGroupsController::index answers {groups: [...]} with no success envelope.
    if (path === '/lead-groups' && method === 'GET') return { status: 200, json: { groups: state.groups } };
    // LeadGroupsController::show (formatGroup with members): options.groupDetails[id], else the summary with no members.
    const groupMatch = /^\/lead-groups\/(\d+)$/.exec(path);
    if (groupMatch && method === 'GET') {
      const id = Number(groupMatch[1]);
      const detail = options.groupDetails?.[id] ?? { ...(state.groups.find((g) => g.id === id) ?? {}), members: [] };
      return { status: 200, json: detail };
    }
    // The Leads page (Lists tab checks): an empty inbox.
    // LeadsController@index answers with the payload itself (no success/data wrapper; LeadsTab reads it off the body).
    // options.leadTabCounts: the Open / Closed counts (the Leads tab shows their sum).
    // inboxLeads (Chris 7 Nov list leads): rows for the Leads inbox, as GET /leads sends them.
    if (path === '/leads' && method === 'GET') return { status: 200, json: { leads: options.inboxLeads ?? [], total: (options.inboxLeads ?? []).length, status_counts: {}, messages_total: 0, meta: { total_pages: 1 }, tab_counts: options.leadTabCounts ?? { open: 0, closed: 0 } } };
    if (path === '/leads/unread-count') return ok({ total_unread: 0, total_unread_messages: 0, total_unread_comments: 0 });
    // leadsAPI.getMyConversations reads {total, conversations} straight off the body (as LeadsTab uses it).
    if (path === '/my-conversations' && method === 'GET') return { status: 200, json: { total: state.conversations.length, conversations: state.conversations } };
    if (state.plan === 'Starter' && (path.startsWith('/newsletter') || path.startsWith('/contact-lists'))) {
      return fail(403, { success: false, code: 'plan_required', message: 'Newsletters are available on paid plans' });
    }
    if (path === '/newsletters' && method === 'GET') {
      const s = params.get('status');
      return ok(state.newsletters.filter((n) => !s || n.status === s).map(summary).reverse());
    }
    if (path === '/newsletters' && method === 'POST') {
      // Server defaults: a "<Month> Newsletter <Year>" name, from name and reply-to from the owner, no audience.
      const n = newsletter(state.nextId++, {
        name: body?.name?.trim() || MONTH_NAME(), from_name: state.owner.name, reply_to_email: state.owner.email,
        audience: [], header: structuredClone(state.brand.header),
      });
      state.newsletters.push(n);
      return ok(n, 201);
    }
    if (path === '/newsletters/audience-count') return ok(audienceCount(body?.audience, body?.channels || []));
    if (path === '/newsletters/images') return ok({ url: state.uploadUrl ?? IMG }, 201);
    if (path === '/newsletters/lead-options' && method === 'GET') {
      // NewsletterLeadOptionsController: 20 a page, newest first; search matches name, email or phone digits; lead_id
      // reads one back.
      const leadId = Number(params.get('lead_id') || 0);
      const search = (params.get('search') || '').trim().toLowerCase();
      const digits = search.replace(/\D+/g, '');
      const rows = leadId ? state.leads.filter((l) => l.id === leadId) : state.leads.filter((l) => !l.unsubscribed && (!search
        || [l.name, l.email].some((v) => String(v ?? '').toLowerCase().includes(search))
        || (digits.length >= 3 && String(l.phone ?? '').replace(/\D+/g, '').includes(digits))));
      const page = Math.max(1, Number(params.get('page') || 1));
      return ok({ data: rows.slice((page - 1) * 20, page * 20), meta: { page, per_page: 20, total: rows.length, total_pages: Math.max(1, Math.ceil(rows.length / 20)) } });
    }
    if (path === '/newsletters/campaign-options' && method === 'GET') {
      // 20 a page, newest first. kind defaults to campaign. search matches the title (+ sku/brand for products,
      // make/model/stock number for vehicles); category narrows products and vehicles.
      const kind = params.get('kind') || 'campaign';
      if (!KINDS.includes(kind)) return fail(422, { message: 'Pick campaigns, products or vehicles.', errors: { kind: ['Pick campaigns, products or vehicles.'] } });
      const search = (params.get('search') || '').toLowerCase();
      const category = params.get('category') || '';
      const page = Math.max(1, Number(params.get('page') || 1));
      const pool = optionsOf(kind);
      const rows = pool.filter((o) => (!search || o.searchText.includes(search)) && (!category || o.category === category));
      const meta = {
        page, total_pages: Math.max(1, Math.ceil(rows.length / 20)), total: rows.length,
        counts: { campaign: state.campaigns.length, product: optionsOf('product').length, vehicle: optionsOf('vehicle').length },
        categories: kind === 'campaign' ? [] : [...new Set(pool.map((o) => o.category).filter(Boolean))].sort(),
      };
      return ok({ data: rows.slice((page - 1) * 20, page * 20).map(({ searchText, ...o }) => o), meta });
    }
    if (path === '/newsletter-brand') {
      if (method === 'PUT') {
        if (body && 'header' in body) state.brand.header = body.header;
        if (body && 'business_address' in body) state.brand.business_address = body.business_address;
        if (body && 'recent_color' in body && options.recentColors !== false) {
          if (typeof body.recent_color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.recent_color)) return fail(422, { message: 'Pick a colour like #6C60FF.', errors: { recent_color: ['Pick a colour like #6C60FF.'] } });
          const c = body.recent_color.toUpperCase();
          state.brand.recent_colors = [c, ...state.brand.recent_colors.filter((x) => x !== c)].slice(0, 8);
        }
        if (body && 'default_message' in body && options.defaultMessageColumn !== false) {
          const text = typeof body.default_message === 'string' ? body.default_message.trim() : '';
          state.brand.default_message = text || null;
        }
      }
      return ok(state.brand);
    }
    if (path === '/newsletter-allowance') return ok(state.allowance);
    if (path === '/contact-lists' && method === 'GET') return ok(state.lists);
    const listsAnswer = listsTab(method, path, params, body);
    if (listsAnswer) return listsAnswer;
    if (path === '/contact-lists/import') {
      // ContactListController::import: name, consent (accepted), consent_type (express|implied), consent_source, rows;
      // then ContactListBuilder::merge.
      const errors = {};
      if (!String(body?.name ?? '').trim()) errors.name = ['Give the list a name.'];
      if (body?.consent !== true) errors.consent = ['Confirm these people agreed to hear from you.'];
      if (!['express', 'implied'].includes(body?.consent_type)) errors.consent_type = ['Choose how these people agreed to hear from you.'];
      if (body?.consent_source != null && String(body.consent_source).length > 120) errors.consent_source = ['Keep the consent note to 120 characters or fewer.'];
      if (!Array.isArray(body?.rows) || !body.rows.length) errors.rows = ['The file has no rows.'];
      else if (body.rows.length > 10000) errors.rows = ['You can import up to 10,000 people at a time.'];
      if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
      const seen = new Map();
      let invalid = 0;
      for (const r of body.rows) {
        const email = EMAIL.test(String(r.email ?? '')) ? String(r.email).toLowerCase() : null;
        const phone = /^\+?\d{7,15}$/.test(String(r.phone ?? '')) ? String(r.phone) : null;
        if (!email && !phone) { invalid++; continue; }
        const key = email ?? phone;
        seen.set(key, { email, phone, merged: seen.has(key) });
      }
      if (!seen.size) return fail(422, { message: 'None of the rows has a valid email address or mobile number.', errors: { rows: ['None of the rows has a valid email address or mobile number.'] } });
      const members = [...seen.values()];
      const merged = body.rows.length - invalid - members.length;
      const list = { id: state.nextId++, name: body.name.trim(), source: 'import', member_count: members.length, email_count: members.filter((m) => m.email).length, sms_count: members.filter((m) => m.phone).length, consent_type: body.consent_type, created_at: now() };
      state.lists.unshift(list);
      return ok({ ...list, imported: members.length, skipped_invalid: invalid, merged_duplicates: merged }, 201);
    }
    if (path === '/contact-lists/from-leads') {
      if (!String(body?.name ?? '').trim()) return fail(422, { message: 'Give the list a name.', errors: { name: ['Give the list a name.'] } });
      if (body?.lead_group_id != null && !state.groups.some((g) => g.id === body.lead_group_id)) {
        return fail(422, { message: 'That lead group was not found.', errors: { lead_group_id: ['That lead group was not found.'] } });
      }
      const group = Boolean(body?.lead_group_id);
      // Leads are implied consent (fromLeads).
      const list = { id: state.nextId++, name: body.name, source: group ? 'lead_group' : 'leads', member_count: group ? 38 : 1210, email_count: group ? 36 : 1180, sms_count: group ? 30 : 310, consent_type: 'implied', created_at: now() };
      state.lists.unshift(list);
      return ok(list, 201);
    }
    let m = path.match(/^\/contact-lists\/(\d+)(\/members)?$/);
    if (m) {
      // ContactListController::findOwnedList: anyone else's (or a deleted) list is a 404.
      const list = state.lists.find((l) => l.id === Number(m[1]));
      if (!list) return fail(404, { success: false, message: 'List not found' });
      if (m[2]) {
        // (Answered by listsTab above; kept for reference.) members(): 50 a page, with each person's consent record.
        const page = Math.max(1, Number(params.get('page') || 1));
        const total = list.member_count;
        const rows = [];
        for (let i = (page - 1) * 50 + 1; i <= Math.min(total, page * 50); i++) {
          rows.push({
            name: i % 9 === 0 ? null : `Contact ${i}`, email: i % 4 === 0 ? null : `contact${i}@example.com`, phone: i % 3 === 0 ? `+1416555${String(1000 + i).slice(-4)}` : null,
            consent_type: list.consent_type ?? null, consent_source: list.consent_type ? (list.source === 'import' ? 'import' : 'lead') : null,
            consent_at: list.consent_type ? '2026-05-01T04:00:00Z' : null,
          });
        }
        return ok({ data: rows, meta: { page, total_pages: Math.max(1, Math.ceil(total / 50)), total } });
      }
      if (method === 'PATCH') {
        // update(): name required, max 120, trimmed; answers the list summary.
        const name = String(body?.name ?? '').trim();
        if (!name) return fail(422, { message: 'Give the list a name.', errors: { name: ['Give the list a name.'] } });
        if (name.length > 120) return fail(422, { message: 'Keep the list name to 120 characters or fewer.', errors: { name: ['Keep the list name to 120 characters or fewer.'] } });
        list.name = name;
        return ok(list);
      }
      if (method === 'DELETE') {
        // destroy(): a scheduled or sending newsletter that still needs the list blocks it.
        const inUse = state.newsletters.some((n) => ['scheduled', 'sending'].includes(n.status) && (n.audience || []).some((a) => a.type === 'list' && a.id === list.id));
        if (inUse) return fail(409, { success: false, message: 'This list is used by a scheduled newsletter. Cancel it first.' });
        state.lists = state.lists.filter((l) => l !== list);
        return ok({});
      }
    }
    m = path.match(/^\/newsletters\/(\d+)(?:\/([a-z-]+))?$/);
    if (m) {
      const n = find(Number(m[1]));
      const action = m[2];
      if (!n) return fail(404, { success: false, message: 'Newsletter not found' });
      if (!action && method === 'GET') return ok(n);
      if (!action && method === 'PUT') {
        if (n.status !== 'draft') return fail(409, { success: false, message: 'Only drafts can be changed. Duplicate this newsletter to make changes.' });
        if (state.failPuts) return fail(state.failPuts, { success: false, message: 'Server Error' });
        // NewsletterController::update: saved elsewhere since this tab's copy (if_unmodified_since is optional).
        if (body?.if_unmodified_since && body.if_unmodified_since !== n.updated_at) {
          return fail(409, { success: false, code: 'stale', message: 'This newsletter was changed somewhere else. Reload to see the latest.' });
        }
        const errors = updateErrors(body);
        for (const [field, message] of Object.entries(state.rejectPut)) if (body && field in body) errors[field] = [message];
        // NewsletterController sms_text: 2,000 characters as texted (NewsletterMessageLimit); messageLimit: 120 = an API
        // whose column the 3 Nov SQL hasn't widened yet.
        const messageLimit = options.messageLimit ?? 2000;
        if (typeof body?.sms_text === 'string' && smsPlain(body.sms_text).length > messageLimit) {
          errors.sms_text = [messageLimit >= 2000 ? `The message can be up to ${messageLimit.toLocaleString('en-US')} characters.` : `The text message can be up to ${messageLimit} characters (some symbols, like …, count as more than one).`];
        }
        if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
        Object.assign(n, pickEditable(body), { updated_at: now() });
        // A Campaigns section: drop ids the owner can't share, then the server's own snapshot (never the client's),
        // refreshed by every PUT that sends blocks (and by duplicate).
        if (body && 'blocks' in body) {
          n.blocks = n.blocks.map((b) => {
            if (b.type !== 'campaigns') return b;
            state.campaignBodies.push(structuredClone(b.data));
            // selections when sent (campaign_ids are then ignored), else an older client's campaign_ids.
            const asked = Array.isArray(b.data?.selections) ? b.data.selections : (b.data?.campaign_ids || []).map((id) => ({ kind: 'campaign', id }));
            const items = asked.map((p) => snapshotItem(p.kind, p.id)).filter(Boolean).slice(0, 6);
            const selections = items.map((i) => ({ kind: i.kind, id: i.id }));
            return { ...b, data: { selections, campaign_ids: selections.filter((p) => p.kind === 'campaign').map((p) => p.id), items, ...campaignLayout(b.data, selections) } };
          });
        }
        // The presenter answers every time in UTC with a Z and no milliseconds.
        if (n.planned_send_at) n.planned_send_at = new Date(n.planned_send_at).toISOString().replace('.000Z', 'Z');
        if (body && 'header' in body) state.brand.header = structuredClone(body.header); // the header is the brand header (note 8)
        return ok(n);
      }
      if (!action && method === 'DELETE') {
        if (!['draft', 'cancelled'].includes(n.status)) return fail(409, { success: false, message: 'Only drafts and cancelled newsletters can be deleted.' });
        state.newsletters = state.newsletters.filter((x) => x !== n);
        return ok({});
      }
      if (action === 'duplicate') {
        // NewsletterController::duplicate: "Copy of <name>" (120 max), a new draft with the same content.
        const copy = newsletter(state.nextId++, { ...pickEditable(n), name: `Copy of ${n.name ?? ''}`.slice(0, 120) });
        state.newsletters.push(copy);
        return ok(copy, 201);
      }
      if (action === 'preview') return ok({ html: previewHtml(n), ...(state.previewSizeKb != null ? { size_kb: state.previewSizeKb } : {}) });
      if (action === 'test') {
        if (state.testsLeft <= 0) return fail(429, { success: false, message: "You've sent the most tests allowed this hour. Try again later." });
        state.testsLeft -= 1;
        // NewsletterTestSendController: 422 channel when the profile has no address, 422 sms_text for an empty text.
        if (body?.channel === 'email' && !state.owner.email) return fail(422, { message: 'Add an email address to your profile to get a test email.', errors: { channel: ['Add an email address to your profile to get a test email.'] } });
        if (body?.channel === 'sms' && !String(n.sms_text ?? '').trim()) return fail(422, { message: 'Write the text message first.', errors: { sms_text: ['Write the text message first.'] } });
        const tooLong = body?.channel === 'sms' ? smsPartsInfo(n.from_name || state.owner.name || 'Stasht', n.sms_text).problem : null;
        if (tooLong) return fail(422, { message: tooLong, errors: { sms_text: [tooLong] } });
        return ok({ sent_to: body?.channel === 'sms' ? '+14165550100' : state.owner.email });
      }
      if (action === 'send' || action === 'schedule') {
        if (state.sendConflict && n.status === 'draft') { n.status = 'scheduled'; n.scheduled_at = now(); }
        // The draft kept changing while it was being sent (NewsletterSendController's stale check).
        if (state.sendStale && n.status === 'draft') return fail(409, { success: false, code: 'stale', message: 'This newsletter was changed in another tab. Reload to see the latest.' });
        if (n.status !== 'draft') return fail(409, { success: false, message: 'Only drafts can be sent. Duplicate this newsletter to send it again.' });
        if (state.sendPaused === 'all') return fail(503, { success: false, code: 'newsletters_paused', message: 'Newsletters are paused. Try again later.' });
        if (state.sendPaused === 'account') return fail(409, { success: false, code: 'newsletters_account_paused', message: 'Sending is paused for this account.' });
        // NewsletterSendController::schedule validates scheduled_at before the send checks.
        if (action === 'schedule') {
          const at = Date.parse(body?.scheduled_at ?? '');
          if (!at) return fail(422, { message: 'Pick a date and time.', errors: { scheduled_at: ['Pick a date and time.'] } });
          if (at <= Date.now()) return fail(422, { message: 'Pick a time in the future.', errors: { scheduled_at: ['Pick a time in the future.'] } });
          const hour = torontoHour(at);
          if ((n.channels || []).includes('sms') && (hour < 8 || hour >= 21)) return fail(422, { message: QUIET_HOURS_ERROR, errors: { scheduled_at: [QUIET_HOURS_ERROR] } });
        }
        const errors = sendErrors(n);
        if (Object.keys(errors).length) {
          // Allowance 422 carries a top-level {channel, needed, remaining} (contract note 4).
          return fail(422, { message: Object.values(errors)[0][0], errors, ...(errors.allowance ? { allowance: { channel: 'email', needed: 1216, remaining: 900 } } : {}) });
        }
        // NewsletterSendController::queue: status, time and sender defaults only; the counts stay 0 until the
        // dispatcher builds the recipient rows.
        n.status = 'scheduled';
        n.scheduled_at = action === 'send' ? now() : new Date(body.scheduled_at).toISOString();
        n.from_name ||= state.owner.name;
        n.reply_to_email ||= state.owner.email;
        return ok(n);
      }
      if (action === 'unschedule') {
        // NewsletterUnscheduleController: only while nothing was created or sent; the time moves to planned_send_at.
        if (n.status === 'scheduled' && !state.unscheduleStarted) {
          Object.assign(n, { status: 'draft', planned_send_at: n.scheduled_at, scheduled_at: null, updated_at: now() });
          return ok(n);
        }
        if (n.status === 'scheduled') n.status = 'sending'; // it started meanwhile
        return fail(409, { success: false, message: ['sending', 'sent'].includes(n.status)
          ? 'This newsletter has started sending, so it can no longer be edited. Duplicate it to make changes.'
          : 'Only scheduled newsletters can be moved back to drafts.' });
      }
      if (action === 'cancel') {
        // NewsletterSendController::cancel: scheduled or sending → cancelled; people not sent to yet are skipped.
        if (!['scheduled', 'sending'].includes(n.status)) return fail(409, { success: false, message: 'Only scheduled or sending newsletters can be cancelled.' });
        if (n.status === 'sending') {
          const queued = n.counts.recipients - n.counts.sent - n.counts.failed - n.counts.skipped;
          n.counts = { ...n.counts, skipped: n.counts.skipped + Math.max(0, queued) };
        }
        n.status = 'cancelled';
        return ok(n);
      }
      // Chris, 29 Oct (round 2), item 6: with textSkips, skipped texts say why (skip_reason / skip_note), as newer APIs do.
      if (action === 'results' && state.textSkips) {
        const answer = results(n, params, state.channelCounts);
        answer.recipients.data = answer.recipients.data.map((r) => ({ ...r, ...(r.status === 'skipped' && r.channel === 'sms' ? { skip_reason: 'no_text_parts', skip_note: 'Not sent: no text parts left' } : { skip_reason: null, skip_note: null }) }));
        return ok(answer);
      }
      if (action === 'results') return ok(results(n, params, state.channelCounts));
    }
    return ok([]);
  }

  async function route(route) {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'i.ytimg.com') return route.fulfill({ path: `${PUBLIC_DIR}pwa-icon-512.png` });
    // CreateMemory loads the Google Picker script on mount; answer it locally with a do-nothing stub so the
    // Storeel form doesn't toast "Failed to load Google Drive picker" over the screenshots.
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.gapi={load:function(n,c){var f=typeof c==="function"?c:(c&&c.callback);if(f)f();}};' });
    }
    // The Campaigns page loads Stripe.js (the upgrade plans); a do-nothing stub keeps it off the network.
    if (url.hostname === 'js.stripe.com') {
      return route.fulfill({ contentType: 'text/javascript', body: 'window.Stripe=function(){return{elements:function(){return{create:function(){return{mount:function(){},on:function(){},destroy:function(){},unmount:function(){}}},getElement:function(){return null}}}}};' });
    }
    if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/nl-img/')) return route.fulfill({ path: `${PUBLIC_DIR}${url.pathname.slice('/nl-img/'.length)}` });
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || /^\/(sso-api|s3-proxy)(\/|$)/.test(url.pathname)) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (!url.pathname.startsWith('/api/react/')) return route.fulfill({ json: { success: true, data: [] } });
    const path = url.pathname.slice('/api/react'.length);
    let body = null;
    const raw = request.postData();
    if (raw && (request.headers()['content-type'] || '').includes('application/json')) {
      try { body = JSON.parse(raw); } catch { body = null; }
    }
    const call = { method: request.method(), path, query: url.search, body };
    state.calls.push(call);
    // The campaign page's caption save (dashboardAPI.updateMemoryImages): a multipart form with _method=PUT.
    const imageMatch = /^\/memory-images\/(\d+)$/.exec(path);
    if (imageMatch && request.method() === 'POST') {
      const form = raw ?? '';
      const field = (name) => new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`).exec(form)?.[1];
      state.imageUpdates.push({ id: Number(imageMatch[1]), description: field('description') ?? null });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: Number(imageMatch[1]), description: field('description') ?? null } }) });
    }
    // The original Add a Moment on a saved campaign (mediaAPI.addMoment, multipart): the new moment joins the campaign.
    if (path === '/memories/upload-photos-after-creation' && request.method() === 'POST') {
      const form = request.postDataBuffer()?.toString('latin1') ?? '';
      const field = (name) => new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`).exec(form)?.[1];
      const memoryId = Number(field('memory_id'));
      const m = state.memories.get(memoryId);
      const post = { id: memoryId * 1000 + (m?.posts?.length ?? 0), parent_id: null, image_link: IMG, title: field('title_0') ?? field('titles[0]') ?? '', description: field('description_0') ?? field('descriptions[0]') ?? '' };
      if (m) m.posts = [...(m.posts ?? []), post];
      state.momentsAdded = [...(state.momentsAdded ?? []), { memoryId, post }];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ image: { ...post, admin_approval: 1 } }] }) });
    }
    if (path === '/newsletters/images') {
      // What reached the upload: the multipart file part's type, name and size (after any shrinking in the browser).
      const buf = request.postDataBuffer();
      const head = buf ? buf.subarray(0, 600).toString('latin1') : '';
      state.uploads.push({ bytes: buf?.length ?? 0, type: /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() ?? null, name: /filename="([^"]*)"/.exec(head)?.[1] ?? null });
      if (state.uploadDelayMs) await new Promise((r) => setTimeout(r, state.uploadDelayMs));
    }
    if (path === '/newsletters/campaign-options' && state.optionsDelayMs) await new Promise((r) => setTimeout(r, state.optionsDelayMs));
    if (state.leadsDelayMs && request.method() === 'GET' && ['/leads', '/lead-groups', '/my-conversations', '/contact-lists'].includes(path)) await new Promise((r) => setTimeout(r, state.leadsDelayMs));
    const answer = handle(request.method(), path, url.searchParams, body);
    call.status = answer.status;
    if (answer.raw !== undefined) return route.fulfill({ status: answer.status, headers: answer.headers, body: answer.raw });
    return route.fulfill({ status: answer.status, contentType: 'application/json', body: JSON.stringify(answer.json) });
  }

  /** Another tab saves this draft: its updated_at moves on, so this tab's next PUT is stale. */
  function editElsewhere(id, patch = {}) {
    const n = find(id);
    if (!n) return;
    Object.assign(n, patch, { updated_at: new Date(Math.max(Date.now(), Date.parse(n.updated_at) + 1000)).toISOString() });
  }

  return { route, state, editElsewhere };
}
