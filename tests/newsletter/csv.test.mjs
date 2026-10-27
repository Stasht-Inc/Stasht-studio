import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMPORT_ROWS, MAX_IMPORT_BYTES, parseCsv, detectColumns, cleanPhone, buildImportRows, columnLabels, listNameFromFile, importSummary, csvFileProblem, NOT_CSV_ERROR,
} from '../../components/newsletters/lib/csv.ts';

test('limits', () => {
  assert.equal(MAX_IMPORT_ROWS, 10000);
  assert.equal(MAX_IMPORT_BYTES, 5 * 1024 * 1024);
});

test('parseCsv handles quotes, commas, CRLF, BOM, other delimiters and blank lines', () => {
  assert.deepEqual(
    parseCsv('﻿Name,Email\r\n"Lee, Dana",dana@example.com\r\n\r\n"Say ""hi""",x@y.co\n'),
    [['Name', 'Email'], ['Lee, Dana', 'dana@example.com'], ['Say "hi"', 'x@y.co']],
  );
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('"multi\nline",z'), [['multi\nline', 'z']]);
  assert.deepEqual(parseCsv(''), []);
});

test('detectColumns reads common header names', () => {
  assert.deepEqual(detectColumns([['Full Name', 'E-mail', 'Mobile']]), { name: 0, firstName: null, lastName: null, email: 1, phone: 2, consentAt: null, hasHeader: true });
  const m = detectColumns([['First name', 'Last name', 'Email address', 'Cell']]);
  assert.deepEqual([m.firstName, m.lastName, m.name, m.email, m.phone, m.hasHeader], [0, 1, null, 2, 3, true]);
});

test('detectColumns guesses from the values when there is no header row', () => {
  assert.deepEqual(
    detectColumns([['Ava Chen', 'ava@example.com', '416-555-0101'], ['Ben Ortiz', 'ben@example.com', '(647) 555-0199']]),
    { name: 0, firstName: null, lastName: null, email: 1, phone: 2, consentAt: null, hasHeader: false },
  );
});

test('cleanPhone keeps digits and a leading +', () => {
  assert.equal(cleanPhone('416-555-0101'), '4165550101');
  assert.equal(cleanPhone('+1 (416) 555-0101'), '+14165550101');
  assert.equal(cleanPhone('call me'), null);
  assert.equal(cleanPhone('12345'), null);
});

test('buildImportRows keeps rows with an email or a mobile, lower-cases emails, counts the rest', () => {
  const table = parseCsv('Full Name,Email,Mobile\nAva Chen,AVA@example.com,416-555-0101\nNo Contact,,\nBen Ortiz,,(647) 555-0199\nCara Diaz,cara@example,\n"Lee, Dana",dana@example.com,\n');
  const r = buildImportRows(table, detectColumns(table));
  assert.equal(r.total, 5);
  assert.equal(r.invalid, 2);
  assert.deepEqual(r.rows, [
    { name: 'Ava Chen', email: 'ava@example.com', phone: '4165550101' },
    { name: 'Ben Ortiz', phone: '6475550199' },
    { name: 'Lee, Dana', email: 'dana@example.com' },
  ]);
  const fl = parseCsv('First name,Last name,Phone\nAva,Chen,+1 416 555 0101');
  assert.deepEqual(buildImportRows(fl, detectColumns(fl)).rows, [{ name: 'Ava Chen', phone: '+14165550101' }]);
});

test('labels, list names and the import summary', () => {
  assert.deepEqual(columnLabels([['Name', 'Email'], ['a', 'b', 'c']], true), ['Name', 'Email', 'Column 3']);
  assert.deepEqual(columnLabels([['a', 'b']], false), ['Column 1', 'Column 2']);
  assert.equal(listNameFromFile('open-house_2026.csv'), 'open house 2026');
  assert.equal(listNameFromFile('.csv'), 'Imported list');
  assert.equal(importSummary({ imported: 1180, skipped_invalid: 20, merged_duplicates: 3 }), 'Imported 1,180 contacts. 20 skipped (no usable email or mobile number). 3 duplicates merged.');
  assert.equal(importSummary({ imported: 1, skipped_invalid: 0, merged_duplicates: 0 }), 'Imported 1 contact.');
});

// Review 9–12 #6: Google Contacts exports; a header row that names only some columns still finds the others.
test('Google Contacts headers, and value guesses for columns a header row does not name', () => {
  const google = [['Name', 'E-mail 1 - Value', 'Phone 1 - Value'], ['Ann Lee', 'ann@x.ca', '+1 416 555 0101']];
  const m = detectColumns(google);
  assert.equal(m.hasHeader, true);
  assert.deepEqual([m.name, m.email, m.phone], [0, 1, 2]);
  const partial = [['Name', 'Notes', 'Contact'], ['Ann Lee', 'VIP', 'ann@x.ca'], ['Bo Chen', 'new', 'bo@x.ca'], ['Cy Ray', '-', '416 555 0199']];
  const p = detectColumns(partial);
  assert.equal(p.hasHeader, true);
  assert.equal(p.email, 2, 'email guessed from the values under a header it does not know');
  assert.equal(buildImportRows(partial, p).rows.length, 2);
});

// Review 9–12 #9.
test('quotes after leading spaces, delimiters inside quotes, and files that are not CSV', () => {
  assert.deepEqual(parseCsv('name, "Lee, Ann", x\n'), [['name', 'Lee, Ann', 'x']]);
  assert.deepEqual(parseCsv('"a,b";c;d\n1;2;3'), [['a,b', 'c', 'd'], ['1', '2', '3']], 'semicolons win: the comma is inside quotes');
  assert.equal(NOT_CSV_ERROR, 'This file isn’t a CSV file. Save it as CSV and try again.');
  assert.equal(csvFileProblem('contacts.xlsx', new Uint8Array([0x50, 0x4b, 3, 4])), NOT_CSV_ERROR);
  assert.equal(csvFileProblem('contacts.csv', new Uint8Array([0x50, 0x4b, 3, 4])), NOT_CSV_ERROR, 'a zip renamed .csv');
  assert.equal(csvFileProblem('contacts.csv', new Uint8Array([0xff, 0xfe, 0x6e, 0])), NOT_CSV_ERROR, 'UTF-16');
  assert.equal(csvFileProblem('contacts.csv', new Uint8Array([0x6e, 0, 0x61, 0])), NOT_CSV_ERROR, 'UTF-16 without a BOM');
  assert.equal(csvFileProblem('contacts.csv', new TextEncoder().encode('name,email\n')), null);
  assert.equal(csvFileProblem('contacts.numbers', new Uint8Array([0x6e])), NOT_CSV_ERROR);
});
