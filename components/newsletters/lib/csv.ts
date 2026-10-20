// CSV import runs in the browser (spec §8: Studio parses, the API gets rows). RFC 4180 quoting, comma / semicolon /
// tab delimiters, header detection with a guess from the values when there is no header row.
import type { ImportRow } from '../../../services/newslettersAPI.ts';
import { isPlausibleEmail } from './rules.ts';
import { formatCount } from './audience.ts';

export const MAX_IMPORT_ROWS = 10000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function detectDelimiter(src: string): string {
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
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
    if (c === '"' && field === '') { quoted = true; i++; continue; }
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
  hasHeader: boolean;
}

const HEADERS: Record<'email' | 'phone' | 'firstName' | 'lastName' | 'name', string[]> = {
  email: ['email', 'emailaddress', 'mail', 'emailid'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobilephone', 'cell', 'cellphone', 'telephone', 'tel', 'sms'],
  firstName: ['firstname', 'first', 'givenname', 'fname'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  name: ['name', 'fullname', 'contactname', 'contact', 'customer', 'customername'],
};
const FIELD_ORDER = ['email', 'phone', 'firstName', 'lastName', 'name'] as const;

export function cleanPhone(value: string): string | null {
  const v = (value ?? '').trim();
  if (!v || /[a-z@]/i.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (v.startsWith('+') ? '+' : '') + digits;
}

export function detectColumns(table: string[][]): ColumnMap {
  const map: ColumnMap = { name: null, firstName: null, lastName: null, email: null, phone: null, hasHeader: false };
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
  if (map.hasHeader) return map;

  // No header row: guess from the first 20 rows.
  const sample = table.slice(0, 20);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const share = (col: number, test: (v: string) => boolean): number => {
    const values = sample.map((r) => r[col] ?? '').filter(Boolean);
    return values.length ? values.filter(test).length / values.length : 0;
  };
  for (let col = 0; col < width; col++) {
    if (map.email === null && share(col, isPlausibleEmail) >= 0.6) map.email = col;
    else if (map.phone === null && share(col, (v) => cleanPhone(v) !== null) >= 0.6) map.phone = col;
  }
  for (let col = 0; col < width; col++) {
    if (col !== map.email && col !== map.phone && share(col, (v) => /[a-z]/i.test(v)) >= 0.6) {
      map.name = col;
      break;
    }
  }
  return map;
}

export function buildImportRows(table: string[][], map: ColumnMap): { rows: ImportRow[]; invalid: number; total: number } {
  const body = map.hasHeader ? table.slice(1) : table;
  const rows: ImportRow[] = [];
  let invalid = 0;
  for (const r of body) {
    const cell = (i: number | null): string => (i === null ? '' : (r[i] ?? '').trim());
    const rawEmail = cell(map.email).toLowerCase();
    const email = isPlausibleEmail(rawEmail) ? rawEmail : '';
    const phone = cleanPhone(cell(map.phone)) ?? '';
    const name = (cell(map.name) || [cell(map.firstName), cell(map.lastName)].filter(Boolean).join(' ')).slice(0, 120);
    if (!email && !phone) {
      invalid++;
      continue;
    }
    const row: ImportRow = {};
    if (name) row.name = name;
    if (email) row.email = email;
    if (phone) row.phone = phone;
    rows.push(row);
  }
  return { rows, invalid, total: body.length };
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
