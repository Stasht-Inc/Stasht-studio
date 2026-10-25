// In-memory stand-in for /api/react used by the newsletter screenshot checks. Shapes follow spec 2026-10-13 §8.
// Nothing leaves the machine: route() aborts every non-local request except the image hosts it answers itself.
import { smsPartsInfo } from '../../../components/newsletters/lib/smsParts.ts';

const PUBLIC_DIR = new URL('../../../public/', import.meta.url).pathname;
// NewsletterSendController::schedule: texts only between 8:00 and 21:00 in NEWSLETTER_DEFAULT_TIMEZONE.
const torontoHour = (ms) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));
const QUIET_HOURS_ERROR = 'Texts can only go out between 8am and 9pm. Pick a time in that window.';
const now = () => new Date().toISOString();
export const COUNTS0 = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
export const IMG = 'https://127.0.0.1/nl-img/pwa-icon-512.png';
const EDITABLE = ['name', 'subject', 'preview_text', 'from_name', 'reply_to_email', 'channels', 'sms_text', 'template', 'header', 'blocks', 'audience'];
// GET /user/profile's real keys: `phone` (not phone_number) and `avatar` (not profile_image); no profile_color.
const PROFILE = {
  name: 'Samantha Smith', email: 'samantha@serpachrysler.ca', phone: '+1 416 555 0100', avatar: null,
  website: 'https://serpachrysler.ca', instagram_url: 'https://instagram.com/serpachrysler', linkedin_url: '', tiktok_url: null,
  facebook_url: 'https://facebook.com/serpachrysler', is_business: 1,
};
// PUT /newsletters/{id} rules, as NewsletterController::rules() and NewsletterContent::normalise*() answer them.
const HTTPS = /^https:\/\/[^\s<>"'\\]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function updateErrors(body) {
  const errors = {};
  if (body && 'name' in body && (typeof body.name !== 'string' || body.name.trim() === '')) errors.name = ['The name field is required.'];
  if (body?.reply_to_email != null && !EMAIL.test(String(body.reply_to_email))) errors.reply_to_email = ['Enter a reply-to email address like name@business.com.'];
  if (body?.template != null && body.template !== 'basic') errors.template = ['That template is coming soon. Use Basic for now.'];
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
    if (b.type === 'youtube' && bad(b.data?.url)) errors[`${key}.url`] = ['Use a YouTube link, like https://www.youtube.com/watch?v=…'];
  });
  return errors;
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
    blocks: [], audience: [{ type: 'all_leads' }], status: 'draft', scheduled_at: null, sent_at: null, public_url: null,
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

function previewHtml(n) {
  const blocks = (n.blocks || []).map((b) => {
    if (b.type === 'title') return `<h2>${esc(b.data.text)}</h2>`;
    if (b.type === 'text') return `<div>${esc(String(b.data.html).replace(/<[^>]+>/g, ''))}</div>`;
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
    brand: { header: { logo_url: null, banner_url: null, background_color: '#6C60FF', title: 'Serpa Chrysler' }, business_address: options.businessAddress ?? null },
    // ContactListController::summary: consent_type (null for lists made before consent was recorded) and created_at.
    lists: options.lists ?? [{ id: 9, name: 'Open house sign-ups', source: 'import', member_count: 212, email_count: 198, sms_count: 140, consent_type: 'express', created_at: '2026-10-02T15:00:00Z' }],
    // AudienceResolver's skipped counts on top of the defaults (consent_expired, unsupported_number, ...).
    skipped: options.skipped ?? {},
    groups: options.groups ?? [{ id: 4, name: 'VIP buyers', member_count: 38, members: [], created_at: now(), updated_at: now() }],
    // NewsletterAllowance::summary: *_pending = held back for newsletters sending or scheduled.
    allowance: options.allowance ?? { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 1200, sms_used: 40, email_pending: 0, sms_pending: 0, resets_at: '2026-11-01T00:00:00Z' },
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
    // Tests left this hour (NewsletterTestSendController's RateLimiter); then 429 with its own message.
    testsLeft: options.testsLeft ?? Infinity,
    // PUT fields to refuse with a 422 ({field: message}), as the API does for a value it won't take.
    rejectPut: options.rejectPut ?? {},
    // Send / schedule find the newsletter already scheduled (sent from another tab): 409, and it is no longer a draft.
    sendConflict: options.sendConflict ?? false,
    // Per-channel results counts by newsletter id, on top of the seeded ones.
    channelCounts: options.channelCounts ?? {},
    // Send / schedule answer as the API does while sending is switched off: 'all' (503 newsletters_paused, the
    // .env switch) or 'account' (409 newsletters_account_paused, one account held).
    sendPaused: options.sendPaused ?? null,
    // POST /newsletters/{id}/preview's size_kb (NewsletterSendCheck's rendered size), when set.
    previewSizeKb: options.previewSizeKb ?? null,
    // Files that reached POST /newsletters/images: {bytes, type, name}.
    uploads: [],
    // Storeels made with POST /memories.
    storeels: [],
    calls: [],
  };
  const ok = (data, status = 200) => ({ status, json: { success: true, data } });
  const fail = (status, json) => ({ status, json });
  const find = (id) => state.newsletters.find((n) => n.id === id);
  const summary = ({ blocks, ...rest }) => rest;

  function audienceCount(audience, channels) {
    let email = 0;
    let sms = 0;
    for (const a of audience || []) {
      if (a.type === 'all_leads') { email += 1180; sms += 310; }
      if (a.type === 'lead_group') { email += 36; sms += 30; }
      if (a.type === 'list') { const l = state.lists.find((x) => x.id === a.id); if (l) { email += l.email_count; sms += l.sms_count; } }
    }
    return {
      email: channels.includes('email') ? email : 0, sms: channels.includes('sms') ? sms : 0,
      skipped: { no_email: 24, no_phone: 0, unsubscribed: 3, duplicate: 11, unsupported_number: 0, consent_expired: 0, ...state.skipped },
    };
  }

  // NewsletterSendCheck::assertReady (plus the reply-to rule for an account with no email).
  function sendErrors(n) {
    if (state.sendErrors) return state.sendErrors;
    const errors = {};
    const channels = (n.channels || []).filter((c) => c === 'email' || c === 'sms');
    if (!String(n.subject ?? '').trim()) errors.subject = ['Add a subject line.'];
    // PUT keeps unfinished sections; send names the first one (contract note 6).
    const missing = (n.blocks || []).flatMap((b, i) => (b.type === 'image' && !b.data?.url ? [`Section ${i + 1} (Image) needs a picture.`] : []));
    if (!n.blocks?.length) errors.blocks = ['Add at least one section to your newsletter.'];
    else if (missing.length) errors.blocks = [missing[0]];
    if (!channels.length) errors.channels = ['Choose email, text message or both.'];
    if (channels.includes('sms') && !String(n.sms_text ?? '').trim()) errors.sms_text = ['Write the text message people will get.'];
    // NewsletterSendCheck::smsTooLong, with the From name queue() fills in.
    else if (channels.includes('sms') && smsPartsInfo(n.from_name || state.owner.name || 'Stasht', n.sms_text).problem) errors.sms_text = [smsPartsInfo(n.from_name || state.owner.name || 'Stasht', n.sms_text).problem];
    if (!String(state.brand.business_address ?? '').trim()) errors.business_address = ['Add your business address. It is shown at the bottom of every newsletter.'];
    if (channels.length) {
      const c = audienceCount(n.audience, channels);
      if (channels.reduce((sum, ch) => sum + c[ch], 0) === 0) errors.audience = ['No one on your recipient lists can be reached by the channels you chose.'];
    }
    if (channels.includes('email') && !n.reply_to_email && !state.owner.email) errors.reply_to_email = ['Add a reply-to email so people can answer you.'];
    return errors;
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
    if (path === '/website-catalogue') return ok({ available: false });
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
    if (path === '/memories' && method === 'POST') {
      const memory = { id: state.nextId++, ...body };
      state.storeels.push(memory);
      return ok({ memory }, 201);
    }
    // LeadGroupsController::index answers {groups: [...]} with no success envelope.
    if (path === '/lead-groups' && method === 'GET') return { status: 200, json: { groups: state.groups } };
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
    if (path === '/newsletters/images') return ok({ url: IMG }, 201);
    if (path === '/newsletter-brand') {
      if (method === 'PUT') {
        if (body && 'header' in body) state.brand.header = body.header;
        if (body && 'business_address' in body) state.brand.business_address = body.business_address;
      }
      return ok(state.brand);
    }
    if (path === '/newsletter-allowance') return ok(state.allowance);
    if (path === '/contact-lists' && method === 'GET') return ok(state.lists);
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
        // members(): 50 a page, ordered by id, with each person's consent record.
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
        if (Object.keys(errors).length) return fail(422, { message: Object.values(errors)[0][0], errors });
        Object.assign(n, pickEditable(body), { updated_at: now() });
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
    if (path === '/newsletters/images') {
      // What reached the upload: the multipart file part's type, name and size (after any shrinking in the browser).
      const buf = request.postDataBuffer();
      const head = buf ? buf.subarray(0, 600).toString('latin1') : '';
      state.uploads.push({ bytes: buf?.length ?? 0, type: /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() ?? null, name: /filename="([^"]*)"/.exec(head)?.[1] ?? null });
      if (state.uploadDelayMs) await new Promise((r) => setTimeout(r, state.uploadDelayMs));
    }
    const { status, json } = handle(request.method(), path, url.searchParams, body);
    call.status = status;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
  }

  /** Another tab saves this draft: its updated_at moves on, so this tab's next PUT is stale. */
  function editElsewhere(id, patch = {}) {
    const n = find(id);
    if (!n) return;
    Object.assign(n, patch, { updated_at: new Date(Math.max(Date.now(), Date.parse(n.updated_at) + 1000)).toISOString() });
  }

  return { route, state, editElsewhere };
}
