// CSV import runs in the browser (spec §8: Studio parses, the API gets rows). RFC 4180 quoting, comma / semicolon /
// tab delimiters, header detection with a guess from the values when there is no header row.
import type { ImportRow } from '../../../services/newslettersAPI.ts';
import { isPlausibleEmail } from './rules.ts';
import { formatCount } from './audience.ts';

export const MAX_IMPORT_ROWS = 10000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const NOT_CSV_ERROR = 'This file isn\u2019t a CSV file. Save it as CSV and try again.';

/** A spreadsheet (xlsx is a zip: "PK"), a Numbers file or UTF-16 text can't be read as CSV. `head` = first bytes. */
export function csvFileProblem(fileName: string, head: Uint8Array): string | null {
  if (/\.(xlsx|xlsm|xls|numbers|ods)$/i.test(fileName)) return NOT_CSV_ERROR;
  if (head[0] === 0x50 && head[1] === 0x4b) return NOT_CSV_ERROR;
  if ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff)) return NOT_CSV_ERROR;
  const sample = head.subarray(0, 64);
  if (sample.length > 1 && sample.filter((b) => b === 0).length * 4 >= sample.length) return NOT_CSV_ERROR;
  return null;
}

function detectDelimiter(src: string): string {
  // Delimiters inside quoted fields don't count.
  const firstLine = (src.split(/\r?\n/, 1)[0] ?? '').replace(/"(?:[^"]|"")*"/g, '');
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ',';
}

export function parseCsv(text: string): string[][] {
  const src = String(text ?? '').replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && field.trim() === '') { field = ''; quoted = true; i++; continue; }
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += c === '\r' && src[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

export interface ColumnMap {
  name: number | null;
  firstName: number | null;
  lastName: number | null;
  email: number | null;
  phone: number | null;
  /** The date each person agreed (sent as consent_at). Only found by its header name. */
  consentAt: number | null;
  hasHeader: boolean;
}

const HEADERS: Record<'email' | 'phone' | 'firstName' | 'lastName' | 'name' | 'consentAt', string[]> = {
  // "E-mail 1 - Value" / "Phone 1 - Value": Google Contacts exports.
  email: ['email', 'emailaddress', 'mail', 'emailid', 'emailvalue'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobilephone', 'cell', 'cellphone', 'telephone', 'tel', 'sms', 'phonevalue'],
  firstName: ['firstname', 'first', 'givenname', 'fname'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  name: ['name', 'fullname', 'contactname', 'contact', 'customer', 'customername'],
  // When they agreed: becomes each row's consent_at (the API reads it as a date, else uses the import time).
  consentAt: ['date', 'signedup', 'signedupon', 'signupdate', 'consentdate', 'consentgiven', 'consentedon', 'optindate', 'optedin', 'optedinon',
    'dateadded', 'subscribed', 'subscribedon', 'subscribedate', 'subscriptiondate', 'joined', 'joinedon', 'datejoined'],
};
const FIELD_ORDER = ['email', 'phone', 'firstName', 'lastName', 'name', 'consentAt'] as const;
/** The API ignores consent dates longer than this (NewsletterConsent::parseDate). */
const MAX_DATE_LENGTH = 40;

export function cleanPhone(value: string): string | null {
  const v = (value ?? '').trim();
  if (!v || /[a-z@]/i.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (v.startsWith('+') ? '+' : '') + digits;
}

// Chris, 29 Oct (round 2), item 7: auto-match never takes a date or time column for Mobile, Name or Email (a
// Mailchimp export's OPTIN_TIME "2024-03-05 14:22:01" has 14 digits, so a phone check alone takes it).
const DATE_TOKENS = new Set(['date', 'time', 'datetime', 'timestamp', 'changed', 'created', 'updated', 'modified', 'birthday', 'birthdate', 'dob', 'day', 'month', 'year']);

/** Header words, split on anything that isn't a letter and on camelCase ("OPTIN_TIME", "createdAt"). */
const headerTokens = (header: string): string[] =>
  (header ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** A header that names a date or time: OPTIN_TIME, CONFIRM_TIME, LAST_CHANGED, …_DATE, Date, Created, updated_at… */
export function isDateTimeHeader(header: string): boolean {
  const tokens = headerTokens(header);
  if (tokens.some((t) => DATE_TOKENS.has(t))) return true;
  const key = tokens.join('');
  if (key === 'candidate') return false;
  return /(date|time|timestamp)$/.test(key) || (tokens.length > 1 && tokens[tokens.length - 1] === 'at');
}

/** Headers for other things a value check could mistake for a mobile number: ids, IP addresses, map positions. */
function isOtherDataHeader(header: string): boolean {
  const tokens = headerTokens(header);
  const key = tokens.join('');
  return /id$/.test(key) || tokens.some((t) => ['ip', 'lat', 'latitude', 'lng', 'lon', 'longitude', 'gmtoff', 'dstoff', 'timezone', 'rating', 'zip', 'zipcode', 'postal', 'postcode'].includes(t));
}

const MONTH_NAME = /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?(?![a-z])/i;
const two = (s: string, max: number, min = 0) => Number(s) >= min && Number(s) <= max;

/** A value that reads as a date and/or time: 2024-03-05, 2024-03-05 14:22:01, 03/05/2024, 14:22, Mar 5, 2024, or a
 *  compact 20240305142201. */
export function looksLikeDateTime(value: string): boolean {
  const v = (value ?? '').trim();
  if (!v || v.length > MAX_DATE_LENGTH) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.test(v)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-](\d{2}|\d{4})(,?\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?)?$/i.test(v)) return true;
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i.test(v)) return true;
  const compact = /^((?:19|20)\d{2})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/.exec(v);
  if (compact && two(compact[2], 12, 1) && two(compact[3], 31, 1) && (compact[4] === undefined || (two(compact[4], 23) && two(compact[5], 59) && (compact[6] === undefined || two(compact[6], 59))))) return true;
  return MONTH_NAME.test(v) && /\d/.test(v) && !Number.isNaN(Date.parse(v));
}

/** A cell that could be a mobile number: digits as cleanPhone reads them, but not a date, time, IP address or
 *  decimal number (a latitude). */
function phoneLike(v: string): boolean {
  const t = (v ?? '').trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t) || /^[+-]?\d+\.\d+$/.test(t)) return false;
  return cleanPhone(t) !== null && !looksLikeDateTime(t);
}

export function detectColumns(table: string[][]): ColumnMap {
  const map: ColumnMap = { name: null, firstName: null, lastName: null, email: null, phone: null, consentAt: null, hasHeader: false };
  (table[0] ?? []).forEach((cell, index) => {
    const key = cell.toLowerCase().replace(/[^a-z]/g, '');
    for (const field of FIELD_ORDER) {
      if (map[field] === null && HEADERS[field].includes(key)) {
        map[field] = index;
        map.hasHeader = true;
        return;
      }
    }
  });
  // Guess from the values (the first 20 rows under any header row): every column with no header row, or the email
  // and phone columns a header row didn't name. A date or time column (by its header or its values) is never taken.
  const sample = table.slice(map.hasHeader ? 1 : 0, (map.hasHeader ? 1 : 0) + 20);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const share = (col: number, test: (v: string) => boolean): number => {
    const values = sample.map((r) => r[col] ?? '').filter(Boolean);
    return values.length ? values.filter(test).length / values.length : 0;
  };
  const header = (col: number) => (map.hasHeader ? table[0]?.[col] ?? '' : '');
  const dateColumn = (col: number) => (map.hasHeader && isDateTimeHeader(header(col))) || share(col, looksLikeDateTime) >= 0.6;
  const taken = (col: number) => [map.name, map.firstName, map.lastName, map.email, map.phone, map.consentAt].includes(col);
  // A header row with no exact Mobile name: a header with mobile or cell, then phone ("Mobile Phone Number", "Work
  // Phone"), when its cells are phone numbers (or empty so far).
  if (map.hasHeader && map.phone === null) {
    const named = (word: RegExp) => Array.from({ length: Math.max(width, table[0]?.length ?? 0) }, (_, col) => col).find((col) =>
      !taken(col) && word.test(headerTokens(header(col)).join('')) && !dateColumn(col)
      && (sample.every((r) => !(r[col] ?? '').trim()) || share(col, phoneLike) >= 0.5));
    const col = named(/mobile|cell/) ?? named(/phone/);
    if (col !== undefined) map.phone = col;
  }
  for (let col = 0; col < width; col++) {
    if (taken(col) || dateColumn(col) || (map.hasHeader && isOtherDataHeader(header(col)))) continue;
    if (map.email === null && share(col, isPlausibleEmail) >= 0.6) map.email = col;
    else if (map.phone === null && share(col, phoneLike) >= 0.6) map.phone = col;
  }
  if (map.hasHeader) return map;
  for (let col = 0; col < width; col++) {
    if (col !== map.email && col !== map.phone && col !== map.consentAt && !dateColumn(col) && share(col, (v) => /[a-z]/i.test(v)) >= 0.6) {
      map.name = col;
      break;
    }
  }
  return map;
}

export type DateOrder = 'dmy' | 'mdy';
const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Slashed dates in a column: day first (some first part > 12), month first (some second part > 12), the same either
 *  way (every day equals its month), ambiguous (the person is asked), or null (no such dates). */
export function consentDateOrder(values: string[]): DateOrder | 'ambiguous' | null {
  let seen = false;
  let dayFirst = false;
  let monthFirst = false;
  let differs = false;
  for (const v of values) {
    const m = NUMERIC_DATE.exec((v ?? '').trim());
    if (!m) continue;
    seen = true;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) dayFirst = true;
    if (b > 12) monthFirst = true;
    if (a !== b) differs = true;
  }
  if (!seen) return null;
  if (dayFirst && !monthFirst) return 'dmy';
  if (monthFirst && !dayFirst) return 'mdy';
  if (!differs) return 'dmy';
  return 'ambiguous';
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, mo: number, d: number, now: Date): string | null {
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (y < 1990 || date.getTime() > now.getTime()) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/**
 * Consent dates read in the browser (the API gets ISO): yyyy-mm-dd and full ISO times as they are; dd/mm/yyyy or
 * mm/dd/yyyy by the column's order (or the person's answer when the column can't tell); a written date like
 * "May 3, 2026". Empty cells are null and not counted; anything else unreadable, in the future or before 1990 is
 * null and counted (the API then uses the import time).
 */
export function readConsentDates(values: string[], order: DateOrder | null, now: Date = new Date()): { values: (string | null)[]; unreadable: number; needsOrder: boolean } {
  const detected = consentDateOrder(values);
  const use: DateOrder | null = detected === 'ambiguous' ? order : detected;
  let unreadable = 0;
  const out = values.map((raw) => {
    const v = (raw ?? '').trim();
    if (!v) return null;
    let iso: string | null = null;
    const isoDate = ISO_DATE.exec(v);
    const numeric = NUMERIC_DATE.exec(v);
    if (isoDate) iso = validDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]), now);
    else if (numeric) {
      if (use) {
        const [a, b, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
        iso = use === 'dmy' ? validDate(y, b, a, now) : validDate(y, a, b, now);
      }
    } else if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const t = Date.parse(v);
      iso = Number.isFinite(t) && t <= now.getTime() && new Date(t).getFullYear() >= 1990 ? new Date(t).toISOString() : null;
    } else if (/[a-z]/i.test(v) && /\d{4}/.test(v) && v.length <= MAX_DATE_LENGTH) {
      const t = new Date(v);
      iso = Number.isNaN(t.getTime()) ? null : validDate(t.getFullYear(), t.getMonth() + 1, t.getDate(), now);
    }
    if (!iso) unreadable++;
    return iso;
  });
  return { values: out, unreadable, needsOrder: detected === 'ambiguous' && !order };
}

/** The consent-date column's cells (under any header row). */
export function consentDateCells(table: string[][], map: ColumnMap): string[] {
  if (map.consentAt === null) return [];
  return (map.hasHeader ? table.slice(1) : table).map((r) => (r[map.consentAt as number] ?? '').trim());
}

export function buildImportRows(table: string[][], map: ColumnMap, dateOrder: DateOrder | null = null, now: Date = new Date()): { rows: ImportRow[]; invalid: number; total: number; unreadableDates: number; needsDateOrder: boolean } {
  const body = map.hasHeader ? table.slice(1) : table;
  const rows: ImportRow[] = [];
  let invalid = 0;
  let unreadableDates = 0;
  const dates = map.consentAt === null ? null : readConsentDates(consentDateCells(table, map), dateOrder, now);
  for (const [index, r] of body.entries()) {
    const cell = (i: number | null): string => (i === null ? '' : (r[i] ?? '').trim());
    const rawEmail = cell(map.email).toLowerCase();
    const email = isPlausibleEmail(rawEmail) ? rawEmail : '';
    const phone = cleanPhone(cell(map.phone)) ?? '';
    const name = (cell(map.name) || [cell(map.firstName), cell(map.lastName)].filter(Boolean).join(' ')).slice(0, 120);
    if (!email && !phone) {
      invalid++;
      continue;
    }
    if (dates && cell(map.consentAt) && !dates.values[index]) unreadableDates++;
    const row: ImportRow = {};
    if (name) row.name = name;
    if (email) row.email = email;
    if (phone) row.phone = phone;
    const consentAt = dates?.values[index];
    if (consentAt) row.consent_at = consentAt;
    rows.push(row);
  }
  return { rows, invalid, total: body.length, unreadableDates, needsDateOrder: dates?.needsOrder ?? false };
}

export function columnLabels(table: string[][], hasHeader: boolean): string[] {
  const width = Math.max(0, ...table.slice(0, 20).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => (hasHeader && table[0]?.[i] ? table[0][i] : `Column ${i + 1}`));
}

export function listNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) || 'Imported list';
}

export function importSummary(r: { imported: number; skipped_invalid: number; merged_duplicates: number }): string {
  const parts = [`Imported ${formatCount(r.imported)} ${r.imported === 1 ? 'contact' : 'contacts'}.`];
  if (r.skipped_invalid) parts.push(`${formatCount(r.skipped_invalid)} skipped (no usable email or mobile number).`);
  if (r.merged_duplicates) parts.push(`${formatCount(r.merged_duplicates)} duplicates merged.`);
  return parts.join(' ');
}
