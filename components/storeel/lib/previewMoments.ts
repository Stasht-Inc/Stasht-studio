// Storeel flow v2 (Deepak, 4 Nov 2026): the moments the live preview shows. Pure, so `node --test` loads it.
//
// Create: every moment "Create Campaign" will make, in the order the web API makes them (MemoriesController::store):
// the picked items first — Website Catalogue products in the order picked (CatalogCampaignCreator keeps the order
// sent; one moment each, plus its "View on website" button card), vehicles and Shopify collections / linked campaigns
// (linked items, shown before the photos on the campaign page) — then the uploaded photos and videos (the `photos` the
// form sends). A product with no photo at all makes no moment (the API skips it); a photo not uploaded yet isn't sent.
// Edit: the campaign's own moments from the campaign page's data (GET /memories/{id}).

// photo: `index` is its place in the form's photos (Create, not saved yet); `postId` its memory_images row (saved).
// title / caption: the moment's title and its caption (memory_images.description), as the campaign page shows them.
// Picked items carry `sourceId`: the picked catalogue item / vehicle / collection / campaign id.
export type PreviewMoment =
  | { kind: 'photo'; key: string; index?: number; postId?: number; image: string | null; video: boolean; title: string; caption: string; location: string; date: string }
  | { kind: 'product'; key: string; sourceId: string; image: string | null; title: string; price: string; cta: boolean; location: string; date: string }
  | { kind: 'vehicle'; key: string; sourceId: string; image: string | null; title: string; price: string; tags: string[] }
  | { kind: 'campaign'; key: string; sourceId: string; image: string | null; title: string; meta: string };

/** What the Create form's "Select from Existing Campaigns" box is picking from. */
export type PickKind = 'catalog' | 'cars' | 'shopify' | 'campaigns' | null;

/** A picker row (CreateMemory normalises every source to this shape). */
export interface PickerItem {
  id: string | number;
  /** Where this row came from when it differs from the box's kind (a vehicle linked from "All Categories"). */
  kind?: Exclude<PickKind, null>;
  title?: string | null;
  last_update_img?: string | null;
  image_link?: string | null;
  thumbnail?: string | null;
  posts_count?: number | null;
  /** Catalogue: "$1,299 CAD", '' without a price. */
  price_label?: string | null;
  /** Catalogue: the product's page on the website (no page: no "View on website" button). */
  url?: string | null;
  /** Cars. */
  price?: string | number | null;
  mileage?: string | number | null;
  stock_number?: string | null;
}

/** An uploaded photo or video as the form sends it (mainPhotosArray). */
export interface PhotoInput {
  /** A key of its own (given when it is added), so a row never changes photo when another is removed. */
  id?: string;
  fileUrl?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  capture_date?: string | null;
}

const VIDEO = /\.(mp4|mov|avi|webm|mkv|m4v)(?:[?#]|$)/i;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const link = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const day = (v: unknown): string => /^(\d{4}-\d{2}-\d{2})/.exec(text(v))?.[1] ?? '';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A vehicle's price as its card shows it on the campaign page ("$34,995"); '' without one. */
export function vehiclePrice(car: { price?: unknown }): string {
  const price = typeof car?.price === 'string' ? parseFloat(car.price) : Number(car?.price);
  return car?.price !== null && car?.price !== undefined && car?.price !== '' && Number.isFinite(price) ? `$${price.toLocaleString('en-US')}` : '';
}

/** A vehicle's mileage and stock number as its card shows them on the campaign page. */
export function vehicleTags(car: { mileage?: unknown; stock_number?: unknown }): string[] {
  const tags: string[] = [];
  if (car?.mileage !== null && car?.mileage !== undefined && car.mileage !== '' && Number.isFinite(Number(car.mileage))) tags.push(`${Number(car.mileage).toLocaleString('en-US')} mi`);
  if (text(car?.stock_number)) tags.push(`Stock #${text(car.stock_number)}`);
  return tags;
}

function pickedMoment(pick: Exclude<PickKind, null>, item: PickerItem, location: string, today: string): PreviewMoment | null {
  const image = link(item.image_link) ?? link(item.last_update_img) ?? link(item.thumbnail);
  const title = text(item.title);
  const count = Math.max(0, Math.floor(Number(item.posts_count) || 0));
  const sourceId = String(item.id);
  switch (pick) {
    case 'catalog':
      if (!image && count === 0) return null;
      return { kind: 'product', key: `catalog-${sourceId}`, sourceId, image, title, price: text(item.price_label), cta: Boolean(link(item.url)), location, date: today };
    case 'cars':
      return { kind: 'vehicle', key: `car-${sourceId}`, sourceId, image, title, price: vehiclePrice(item), tags: vehicleTags(item) };
    case 'shopify':
      return { kind: 'campaign', key: `shopify-${sourceId}`, sourceId, image, title, meta: plural(count, 'product', 'products') };
    default:
      return { kind: 'campaign', key: `campaign-${sourceId}`, sourceId, image, title, meta: plural(count, 'photo', 'photos') };
  }
}

/** Create: the moments the form will make (see the top of this file). `today`: YYYY-MM-DD. */
export function createPreviewMoments({ pick, picked, selectedIds, photos, location, today }: {
  pick: PickKind;
  picked: ReadonlyArray<PickerItem>;
  /** The picked ids, in the order they were picked. */
  selectedIds: ReadonlyArray<string>;
  photos: ReadonlyArray<PhotoInput>;
  /** The campaign's location (a product moment carries it). */
  location: string;
  today: string;
}): PreviewMoment[] {
  const moments: PreviewMoment[] = [];
  if (pick) {
    const byId = new Map(picked.map((item) => [String(item.id), item]));
    for (const id of selectedIds) {
      const item = byId.get(String(id));
      const m = item ? pickedMoment(item.kind ?? pick, item, text(location), today) : null;
      if (m) moments.push(m);
    }
  }
  photos.forEach((p, i) => {
    const image = link(p.fileUrl);
    if (!image) return;
    moments.push({
      kind: 'photo', key: `photo-${p.id ?? i}`, index: i, image, video: VIDEO.test(image), title: text(p.title), caption: text(p.description), location: text(p.location), date: day(p.capture_date) || today,
    });
  });
  return moments;
}

function linkedMoment(lm: Record<string, any>): PreviewMoment {
  const image = link(lm.cover_image) ?? link(lm.last_update_img) ?? link(lm.image_link);
  const title = text(lm.title);
  const sourceId = String(lm.id);
  if (lm.is_car === true || Number(lm.is_car) === 1) return { kind: 'vehicle', key: `car-${sourceId}`, sourceId, image, title, price: vehiclePrice(lm), tags: vehicleTags(lm) };
  const count = Math.max(0, Math.floor(Number(lm.posts_count) || 0));
  return { kind: 'campaign', key: `campaign-${sourceId}`, sourceId, image, title, meta: plural(count, 'photo', 'photos') };
}

function postMoment(p: Record<string, any>): PreviewMoment {
  const image = link(p.image_link) ?? link(p.master_image_link) ?? link(p.media_url);
  const postId = Number(p.id);
  return {
    kind: 'photo', key: `post-${p.id}`, ...(Number.isFinite(postId) ? { postId } : {}), image, video: Boolean(image && VIDEO.test(image)),
    title: text(p.title), caption: typeof p.description === 'string' ? p.description.trim() : '', location: text(p.location), date: day(p.capture_date),
  };
}

/**
 * Edit: the campaign's own moments (GET /memories/{id} / the campaign page's data) — its linked vehicles and
 * campaigns, then its top-level moments (sub-photos belong to their moment), or the campaign's own order
 * (unified_order) when it has one, as the campaign page shows them.
 */
export function savedPreviewMoments(memory: Record<string, any> | null | undefined): PreviewMoment[] {
  if (!memory || typeof memory !== 'object') return [];
  const linked: Array<Record<string, any>> = Array.isArray(memory.linked_memories) ? memory.linked_memories.filter((l: any) => l && l.id !== undefined) : [];
  const posts: Array<Record<string, any>> = Array.isArray(memory.posts) ? memory.posts.filter((p: any) => p && (p.parent_id === null || p.parent_id === undefined)) : [];
  const items: Array<{ type: 'linked' | 'post'; id: string; moment: PreviewMoment }> = [
    ...linked.map((l) => ({ type: 'linked' as const, id: String(l.id), moment: linkedMoment(l) })),
    ...posts.map((p) => ({ type: 'post' as const, id: String(p.id), moment: postMoment(p) })),
  ];
  const order = Array.isArray(memory.unified_order) ? memory.unified_order : [];
  if (!order.length) return items.map((i) => i.moment);
  const ordered: PreviewMoment[] = [];
  const used = new Set<string>();
  for (const entry of order) {
    const type = entry?.type === 'linked_memory' ? 'linked' : 'post';
    const found = items.find((i) => i.type === type && i.id === String(entry?.id));
    if (found && !used.has(`${type}-${found.id}`)) { ordered.push(found.moment); used.add(`${type}-${found.id}`); }
  }
  for (const i of items) if (!used.has(`${i.type}-${i.id}`)) ordered.push(i.moment);
  return ordered;
}
