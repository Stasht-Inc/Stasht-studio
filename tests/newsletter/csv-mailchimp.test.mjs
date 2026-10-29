// Chris, 29 Oct (round 2), item 7: auto-match never picks a date or time column (Mailchimp's OPTIN_TIME,
// CONFIRM_TIME, LAST_CHANGED, ...) for Mobile, Name or Email, and prefers headers with phone / mobile / cell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImportRows, detectColumns, isDateTimeHeader, looksLikeDateTime, parseCsv } from '../../components/newsletters/lib/csv.ts';

const MAILCHIMP_HEADER = 'Email Address,First Name,Last Name,Address,Phone Number,Birthday,MEMBER_RATING,OPTIN_TIME,OPTIN_IP,CONFIRM_TIME,CONFIRM_IP,LATITUDE,LONGITUDE,GMTOFF,DSTOFF,TIMEZONE,CC,REGION,LAST_CHANGED,LEID,EUID,NOTES,TAGS';
const MAILCHIMP_ROWS = [
  'ava@example.com,Ava,Chen,"12 King St W  Toronto ON M5H 1A1 CA",+1 416 555 0101,03/15,2,2024-03-05 14:22:01,192.168.1.10,2024-03-05 14:25:13,192.168.1.11,43.6532,-79.3832,-5,-4,America/Toronto,CA,ON,2024-06-01 09:10:11,153856109,a1b2c3d4e5,,"""VIP"""',
  'ben@example.com,Ben,Ortiz,,(647) 555-0199,,4,2024-04-11 08:01:44,10.0.0.7,2024-04-11 08:03:02,10.0.0.8,45.4215,-75.6972,-5,-4,America/Toronto,CA,ON,2024-07-19 17:45:00,153856110,f6g7h8i9j0,Asked about winter tires,',
  'cara@example.com,Cara,Diaz,,,,3,2024-05-02 19:30:00,172.16.4.20,2024-05-02 19:31:12,172.16.4.21,43.2557,-79.8711,-5,-4,America/Toronto,CA,ON,2024-08-02 11:00:59,153856111,k1l2m3n4o5,,',
];

const dropColumn = (line, index) => {
  const cells = parseCsv(line)[0];
  return cells.filter((_, i) => i !== index).map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
};

test('a Mailchimp export: Email Address, First and Last Name and Phone Number; no date or time column taken', () => {
  const table = parseCsv([MAILCHIMP_HEADER, ...MAILCHIMP_ROWS].join('\n'));
  const m = detectColumns(table);
  assert.equal(m.hasHeader, true);
  assert.deepEqual([m.email, m.firstName, m.lastName, m.name, m.phone], [0, 1, 2, null, 4]);
  assert.equal(m.consentAt, null, 'OPTIN_TIME is left for the person to choose as the date they agreed');
  assert.deepEqual(buildImportRows(table, m).rows, [
    { name: 'Ava Chen', email: 'ava@example.com', phone: '+14165550101' },
    { name: 'Ben Ortiz', email: 'ben@example.com', phone: '6475550199' },
    { name: 'Cara Diaz', email: 'cara@example.com' },
  ]);
});

test('a Mailchimp export with NO phone column: Mobile stays unset (never OPTIN_TIME, an IP, a latitude or LEID)', () => {
  const header = dropColumn(MAILCHIMP_HEADER, 4);
  assert.ok(!/Phone/.test(header));
  const table = parseCsv([header, ...MAILCHIMP_ROWS.map((r) => dropColumn(r, 4))].join('\n'));
  const m = detectColumns(table);
  assert.equal(m.phone, null);
  assert.deepEqual([m.email, m.firstName, m.lastName, m.name], [0, 1, 2, null]);
  assert.deepEqual(buildImportRows(table, m).rows.map((r) => r.phone), [undefined, undefined, undefined]);
});

test('date and time headers are never Mobile, Name or Email, even when their values look like numbers', () => {
  for (const h of ['OPTIN_TIME', 'CONFIRM_TIME', 'LAST_CHANGED', 'Created', 'updated_at', 'Date', 'Time', 'Signup Date', 'createdAt', 'TIMESTAMP', 'Birthday']) {
    assert.equal(isDateTimeHeader(h), true, h);
  }
  for (const h of ['Phone Number', 'Mobile', 'Email Address', 'Name', 'Candidate', 'Notes']) assert.equal(isDateTimeHeader(h), false, h);
  // Values a phone check alone would take: 14 digits in a date-time, 10 in an IP.
  const m = detectColumns([['Name', 'Contact', 'Seen'], ['Ava', 'ava@example.com', '20240305142201'], ['Ben', 'ben@example.com', '20240411080144']]);
  assert.equal(m.phone, null, 'an unknown header with date-time digits is not a phone');
  const m2 = detectColumns([['Name', 'Email', 'Mobile opt-in time'], ['Ava', 'ava@example.com', '2024-03-05 14:22:01']]);
  assert.equal(m2.phone, null, '"mobile" in a time header does not make it the Mobile column');
});

test('headers with phone, mobile or cell win (mobile and cell before phone)', () => {
  assert.equal(detectColumns([['Name', 'Email', 'Work Phone'], ['Ava', 'a@x.ca', '416 555 0101']]).phone, 2);
  assert.equal(detectColumns([['Name', 'Email', 'Home Phone', 'Mobile Phone Number'], ['Ava', 'a@x.ca', '416 555 0101', '647 555 0199']]).phone, 3);
  assert.equal(detectColumns([['Name', 'Cell #', 'Email'], ['Ava', '647 555 0199', 'a@x.ca']]).phone, 1);
  // A phone-named column that holds no phone numbers isn't taken.
  assert.equal(detectColumns([['Name', 'Email', 'Phone verified'], ['Ava', 'a@x.ca', 'yes'], ['Ben', 'b@x.ca', 'no']]).phone, null);
});

test('no header row: a date-time column is not the mobile, and a written-date column is not the name', () => {
  const m = detectColumns([['Ava Chen', 'ava@example.com', '2024-03-05 14:22:01'], ['Ben Ortiz', 'ben@example.com', '2024-04-11 08:01:44']]);
  assert.deepEqual([m.name, m.email, m.phone], [0, 1, null]);
  const w = detectColumns([['Mar 5, 2024', 'Ava Chen', 'ava@example.com'], ['Apr 11, 2024', 'Ben Ortiz', 'ben@example.com']]);
  assert.equal(w.name, 1);
});

test('looksLikeDateTime', () => {
  for (const v of ['2024-03-05', '2024-03-05 14:22:01', '2024-03-05T14:22:01Z', '03/05/2024', '5.3.2024 14:22', '14:22', '2:22 pm', 'Mar 5, 2024', '5 March 2024']) assert.equal(looksLikeDateTime(v), true, v);
  for (const v of ['416-555-0101', '+1 416 555 0101', '(647) 555-0199', '4165550101', 'Ava Chen', '192.168.1.10', '']) assert.equal(looksLikeDateTime(v), false, v);
});

// Review: the date/time suffix rule looks at the last word only, and a header naming a phone is never a date column.
test('isDateTimeHeader: last word only; phone, mobile, cell and tel headers are never dates; no "Update" false positive', () => {
  for (const h of ['Cell (Daytime)', 'Phone (Daytime)', 'Mobile (evening time)', 'Tel - daytime', 'Telephone Date Added', 'Update', 'Last update', 'Candidate', 'Timeline notes', 'Datestamp source']) {
    assert.equal(isDateTimeHeader(h), false, h);
  }
  for (const h of ['OPTINTIME', 'Optin_time', 'signupdate', 'datetime', 'Last changed', 'created_at', 'Sent at']) assert.equal(isDateTimeHeader(h), true, h);
  // Eligible for Mobile: a "(Daytime)" phone column is taken.
  assert.equal(detectColumns([['Name', 'Email', 'Cell (Daytime)'], ['Ava', 'a@x.ca', '416 555 0101']]).phone, 2);
  assert.equal(detectColumns([['Name', 'Email', 'Phone (Daytime)'], ['Ava', 'a@x.ca', '416 555 0101']]).phone, 2);
});
