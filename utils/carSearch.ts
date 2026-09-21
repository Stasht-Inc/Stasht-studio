// "Smart" inventory search for the Share New Cars picker (Chris, 2026-09-21: "search
// inventory, price or year" — e.g. pull every car around $25,000).
//
// One box understands three things at once, in any order:
//   words  — every word must appear in the title/make/model   ("bmw x5", "hybrid")
//   year   — 2024, 2022-2024, 2022 to 2024, since/after 2022, before/until 2020
//   price  — $25,000, 25000, 25k, under 30k, over 20k, 20k-30k, $20,000 - $30,000, 20-30k
//
// A bare price means "up to that price" (a rep looking for a $25,000 budget wants cars at
// or below it; nobody types an exact price like $28,995). Type a range to be precise.
// The same rules are mirrored in the app (lib/utils/car_search.dart) — keep them in sync.

export interface Range { min: number | null; max: number | null }
export interface ParsedCarSearch { words: string[]; year: Range | null; price: Range | null }
export interface SearchableCar {
  title?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  price?: number | string | null;
}

const MIN_YEAR = 1980;
const MAX_YEAR = 2100;
// A money-looking number: optional $, digits with optional commas/decimals, optional k.
const NUM = String.raw`\$?\s*\d[\d,]*(?:\.\d+)?\s*k?`;

const isYearLiteral = (s: string) => /^\d{4}$/.test(s.trim()) && Number(s) >= MIN_YEAR && Number(s) <= MAX_YEAR;

function toNumber(raw: string): number {
  const t = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(t);
  return /k$/.test(t) ? n * 1000 : n;
}

const hasUnit = (raw: string) => /[$k]/.test(raw);

export function parseCarSearch(query: string): ParsedCarSearch {
  let q = ` ${query.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  let year: Range | null = null;
  let price: Range | null = null;
  const setYear = (min: number | null, max: number | null) => {
    year = { min: min ?? year?.min ?? null, max: max ?? year?.max ?? null };
  };
  const setPrice = (min: number | null, max: number | null) => {
    price = { min: min ?? price?.min ?? null, max: max ?? price?.max ?? null };
  };
  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    q = q.replace(re, (...args) => {
      const groups = args.slice(0, -2) as string[];
      const m = groups as unknown as RegExpExecArray;
      fn(m);
      return ' ';
    });
  };

  // year words: since/after/from 2022 · before/until/through 2020
  take(/\s(?:since|after|from)\s+(\d{4})(?=\s)/g, (m) => { if (isYearLiteral(m[1])) setYear(Number(m[1]), null); });
  take(/\s(?:before|until|through|thru)\s+(\d{4})(?=\s)/g, (m) => { if (isYearLiteral(m[1])) setYear(null, Number(m[1])); });

  // price words: under/below/max/up to/<  ·  over/above/min/at least/>
  take(new RegExp(String.raw`\s(?:under|below|less than|up to|max(?:imum)?|<=?|≤)\s*(${NUM})(?=\s)`, 'g'), (m) => setPrice(null, toNumber(m[1])));
  take(new RegExp(String.raw`\s(?:over|above|more than|at least|min(?:imum)?|>=?|≥)\s*(${NUM})(?=\s)`, 'g'), (m) => setPrice(toNumber(m[1]), null));

  // ranges: 20k-30k · 20000 to 30000 · $20,000 - $30,000 · 20-30k · 2022-2024
  take(new RegExp(String.raw`\s(${NUM})\s*(?:-|–|—|to)\s*(${NUM})(?=\s)`, 'g'), (m) => {
    const a = m[1].trim(), b = m[2].trim();
    if (isYearLiteral(a) && isYearLiteral(b)) {
      setYear(Math.min(Number(a), Number(b)), Math.max(Number(a), Number(b)));
      return;
    }
    let lo = toNumber(a), hi = toNumber(b);
    if (!hasUnit(a) && hasUnit(b) && /k$/.test(b.replace(/\s/g, '')) && lo < 1000) lo *= 1000; // "20-30k"
    if (lo > hi) [lo, hi] = [hi, lo];
    setPrice(lo, hi);
  });

  // what's left: bare numbers are a year or a "up to" price, everything else is a word
  const words: string[] = [];
  for (const token of q.split(' ').filter(Boolean)) {
    if (new RegExp(`^${NUM}$`).test(token)) {
      if (isYearLiteral(token)) { setYear(Number(token), Number(token)); continue; }
      if (hasUnit(token) || toNumber(token) >= 1000) { setPrice(null, toNumber(token)); continue; }
    }
    words.push(token);
  }
  return { words, year, price };
}

export function isEmptySearch(s: ParsedCarSearch): boolean {
  return s.words.length === 0 && !s.year && !s.price;
}

export function matchesCarSearch(car: SearchableCar, s: ParsedCarSearch): boolean {
  if (s.year) {
    const y = car.year == null || car.year === '' ? NaN : parseInt(String(car.year), 10);
    if (!Number.isFinite(y)) return false;
    if (s.year.min != null && y < s.year.min) return false;
    if (s.year.max != null && y > s.year.max) return false;
  }
  if (s.price) {
    const p = car.price == null || car.price === '' ? NaN : typeof car.price === 'string' ? parseFloat(car.price) : car.price;
    if (!Number.isFinite(p)) return false;
    if (s.price.min != null && p < s.price.min) return false;
    if (s.price.max != null && p > s.price.max) return false;
  }
  if (s.words.length) {
    const hay = [car.title, car.make, car.model].filter(Boolean).join(' ').toLowerCase();
    if (!s.words.every((w) => hay.includes(w))) return false;
  }
  return true;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// Plain-English echo of what the search understood — shown under the box so the rep can
// see, e.g., that "25k" means "up to $25,000".
export function describeCarSearch(s: ParsedCarSearch): string[] {
  const out: string[] = [];
  if (s.price) {
    const { min, max } = s.price;
    out.push(min != null && max != null ? `Price ${money(min)} – ${money(max)}` : max != null ? `Price up to ${money(max)}` : `Price over ${money(min as number)}`);
  }
  if (s.year) {
    const { min, max } = s.year;
    out.push(min != null && max != null ? (min === max ? `Year ${min}` : `Years ${min} – ${max}`) : max != null ? `Year ${max} or older` : `Year ${min} or newer`);
  }
  return out;
}
