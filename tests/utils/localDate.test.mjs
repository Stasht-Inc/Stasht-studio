// "Today" is the browser's local date, not the UTC one (4 Nov 2026 review): in Toronto after 19:00, or in India just
// after midnight, toISOString() gave the wrong day to new campaigns and moments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateISO, isoToApiDay, dayOf } from '../../utils/localDate.ts';

const inZone = (tz, fn) => {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
};

test('Toronto at 20:00 local is still that day (UTC is already the next day)', () => {
  inZone('America/Toronto', () => {
    const evening = new Date('2026-11-05T01:00:00Z'); // 4 Nov, 20:00 in Toronto
    assert.equal(evening.toISOString().slice(0, 10), '2026-11-05', 'the old UTC way: tomorrow');
    assert.equal(localDateISO(evening), '2026-11-04');
  });
});

test('India just after midnight is already the next day (UTC is still the day before)', () => {
  inZone('Asia/Kolkata', () => {
    assert.equal(localDateISO(new Date('2026-11-04T19:00:00Z')), '2026-11-05'); // 5 Nov, 00:30 IST
  });
});

test('a picked day goes to the API as that day in every time zone ("Nov 04, 2026", never the day before)', () => {
  for (const tz of ['America/Toronto', 'Asia/Kolkata', 'UTC', 'Pacific/Honolulu']) {
    inZone(tz, () => {
      assert.equal(isoToApiDay('2026-11-04'), 'Nov 04, 2026', tz);
      assert.equal(isoToApiDay('2026-01-31'), 'Jan 31, 2026', tz);
    });
  }
  assert.equal(isoToApiDay(''), '');
  assert.equal(isoToApiDay('soon'), '');
});

// dayOf: the calendar day a photo's capture_date names (4 Nov 2026 review). new Date('2026-11-04 22:30:00').toISOString()
// is read as local time then converted to UTC: in Toronto that is 5 Nov, so the saved date disagreed with the preview.
test('dayOf: a plain date is that day', () => {
  assert.equal(dayOf('2026-11-04'), '2026-11-04');
});

test('dayOf: date + time with no zone keeps the written day, in Toronto in the evening and in Kolkata', () => {
  for (const tz of ['America/Toronto', 'Asia/Kolkata']) {
    inZone(tz, () => {
      assert.equal(dayOf('2026-11-04 22:30:00'), '2026-11-04', tz);
      assert.equal(dayOf('2026-11-04T22:30:00'), '2026-11-04', tz);
      assert.equal(dayOf('2026-11-04T00:15:00'), '2026-11-04', tz);
    });
  }
});

test('dayOf: the EXIF colon format is that day', () => {
  assert.equal(dayOf('2026:11:04 22:30:00'), '2026-11-04');
  assert.equal(dayOf('2026:11:04'), '2026-11-04');
});

test('dayOf: an ISO value with Z is that written day (same as the preview)', () => {
  inZone('America/Toronto', () => {
    assert.equal(dayOf('2026-11-05T01:00:00Z'), '2026-11-05');
  });
});

test('dayOf: other parsable formats fall back to the LOCAL day, never UTC', () => {
  inZone('America/Toronto', () => {
    assert.equal(dayOf('Nov 4, 2026 22:30:00'), '2026-11-04');
  });
  inZone('Asia/Kolkata', () => {
    assert.equal(dayOf('Nov 4, 2026 00:15:00'), '2026-11-04');
  });
});

test('dayOf: empty, null and junk give an empty string', () => {
  assert.equal(dayOf(''), '');
  assert.equal(dayOf('   '), '');
  assert.equal(dayOf(null), '');
  assert.equal(dayOf(undefined), '');
  assert.equal(dayOf('not a date'), '');
});
