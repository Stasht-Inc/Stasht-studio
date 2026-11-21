// Chris 16 Nov 2026 (point 4): the public campaign page's "Enquire" button on product moments whose product has
// "Show the Enquire button" on. The web API lists them as `enquire_products: [{post_id, title}]` on
// GET /published-memories and GET /memory-detail/{id}; POST /memories/{id}/enquire sends one. Pure, so `node --test` loads it.

export const ENQUIRY_SENT = "Thanks! We'll be in touch.";
export const ENQUIRY_MAX_MESSAGE = 1000;

/** The message box's starting text. */
export function enquiryMessage(title: string | null | undefined): string {
  const t = (title || '').trim();
  return t ? `Hi, I'm interested in ${t}.` : "Hi, I'm interested in this product.";
}

/** post id (string) → product title, for the moments that show an Enquire button. Anything malformed is skipped. */
export function enquirePostMap(list: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(list)) return out;
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as any).post_id;
    if (id === null || id === undefined || id === '' || id === 0) continue;
    out.set(String(id), typeof (row as any).title === 'string' ? (row as any).title : '');
  }
  return out;
}

/** post id (string) → the product's button colour (Chris 21 Nov 2026, R2-2: `button_color` on each entry), for the
 *  outlined Enquire button. Entries without one (an older web API) are left out: the button stays purple. */
export function enquireColorMap(list: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(list)) return out;
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as any).post_id;
    const color = (row as any).button_color;
    if (id === null || id === undefined || id === '' || id === 0 || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) continue;
    out.set(String(id), color.toUpperCase());
  }
  return out;
}

/** A failed send as field errors (under their field) and one general line (bottom of the card). */
export function enquiryErrors(status: number, body: any): { fields: { name?: string; contact?: string; message?: string }; general: string } {
  const fields: { name?: string; contact?: string; message?: string } = {};
  const errs = body && typeof body === 'object' && body.errors && typeof body.errors === 'object' ? body.errors : null;
  const first = (k: string): string | undefined => (Array.isArray(errs?.[k]) && typeof errs[k][0] === 'string' ? errs[k][0] : undefined);
  if (errs) {
    if (first('name')) fields.name = first('name');
    const contact = first('phone') || first('email');
    if (contact) fields.contact = contact;
    if (first('message')) fields.message = first('message');
  }
  const anyField = Object.keys(fields).length > 0;
  let general = '';
  if (status === 429) general = 'Too many tries. Please wait a minute and try again.';
  else if (status === 404) general = 'This product is no longer available.';
  else if (!anyField) general = (body && typeof body.message === 'string' && body.message) || 'Something went wrong. Please try again.';
  return { fields, general };
}
