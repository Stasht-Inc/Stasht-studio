// Chris, 3 Nov 2026: "If this is for a single person, then we need the email address here, or phone number if chosen.
// It has to be simple. We aren't going to send them to the leads page to add 1 email address or phone number. Make sure
// Phone number has Country Code and Phone number like we have on all other views on the platform."
// Single person = audience [{type: 'person', email?, phone?}] from boxes that follow Send by.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_UNSUBSCRIBED, PERSON_BAD_EMAIL, PHONE_UNSUBSCRIBED, audienceFromFields, countableAudience, fieldsFromAudience, fieldsFromLead,
  personBoxProblems, personCountSummary, personEntry, personEntryProblem, personSendProblem, personStatusProblems, personSummary,
} from '../../components/newsletters/lib/person.ts';
import { MEMBER_PHONE_INCOMPLETE } from '../../components/leads/lists/memberPhone.ts';
import { audienceKey, audienceLabel, isSinglePerson, toggleGroupItem } from '../../components/newsletters/lib/audience.ts';
import { emptyDraft, fieldProblems, savableChanges } from '../../components/newsletters/lib/draft.ts';
import { preSendProblems } from '../../components/newsletters/lib/sendChecks.ts';

const empty = { email: '', phoneCode: '+1', phone: '' };
const zero = { email: 0, sms: 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0, consent_expired: 0, unsupported_number: 0 } };

test('the boxes start empty on +1, or show a saved person', () => {
  assert.deepEqual(fieldsFromAudience([]), empty);
  assert.deepEqual(fieldsFromAudience([{ type: 'all_leads' }]), empty);
  assert.deepEqual(fieldsFromAudience([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), { email: 'jordan@example.com', phoneCode: '+1', phone: '4165550171' });
  assert.deepEqual(fieldsFromAudience([{ type: 'person', phone: '+447911123456' }]), { email: '', phoneCode: '+44', phone: '7911123456' });
});

test('a picked lead fills both boxes', () => {
  assert.deepEqual(fieldsFromLead({ id: 1, name: 'Jordan', email: 'jordan@example.com', phone: '+14165550171', unsubscribed: false }), { email: 'jordan@example.com', phoneCode: '+1', phone: '4165550171' });
  assert.deepEqual(fieldsFromLead({ id: 2, name: 'Marcus', email: null, phone: '+19055550142', unsubscribed: false }), { email: '', phoneCode: '+1', phone: '9055550142' });
  assert.deepEqual(fieldsFromLead({ id: 3, name: 'Becky', email: 'becky@example.com', phone: null, unsubscribed: false }), { email: 'becky@example.com', phoneCode: '+1', phone: '' });
});

test('the audience follows Send by: only the boxes showing, the phone in E.164 with its country code', () => {
  const both = { email: ' Jordan@Example.com ', phoneCode: '+1', phone: '(416) 555-0171' };
  assert.deepEqual(audienceFromFields(both, ['email']), [{ type: 'person', email: 'Jordan@Example.com' }]);
  assert.deepEqual(audienceFromFields(both, ['sms']), [{ type: 'person', phone: '+14165550171' }]);
  assert.deepEqual(audienceFromFields(both, ['email', 'sms']), [{ type: 'person', email: 'Jordan@Example.com', phone: '+14165550171' }]);
  assert.deepEqual(audienceFromFields({ ...empty, phoneCode: '+44', phone: '07911 123456' }, ['sms']), [{ type: 'person', phone: '+447911123456' }], 'trunk 0 dropped, like every Studio phone field');
  assert.deepEqual(audienceFromFields(empty, ['email', 'sms']), [], 'nothing typed: nobody yet');
  assert.deepEqual(audienceFromFields({ ...empty, phone: '4165550171' }, ['email']), [], 'a hidden box is not sent to');
  assert.deepEqual(audienceFromFields(both, []), []);
});

test('the boxes showing are checked like the other Studio email and phone fields', () => {
  assert.deepEqual(personBoxProblems(empty, ['email', 'sms']), {});
  assert.deepEqual(personBoxProblems({ ...empty, email: 'jordan@example' }, ['email']), { email: PERSON_BAD_EMAIL });
  assert.equal(PERSON_BAD_EMAIL, 'Enter an email address like name@example.com.');
  assert.deepEqual(personBoxProblems({ ...empty, phone: '416 555' }, ['sms']), { phone: MEMBER_PHONE_INCOMPLETE });
  assert.deepEqual(personBoxProblems({ ...empty, phone: '416 555' }, ['email']), {}, 'a hidden box has no problem');
  assert.deepEqual(personBoxProblems({ email: 'jordan@example.com', phoneCode: '+1', phone: '4165550171' }, ['email', 'sms']), {});
});

test('a half-typed person stays in the draft but is held back from autosave and not counted', () => {
  const half = [{ type: 'person', email: 'jordan@exa' }];
  assert.equal(personEntryProblem(half), PERSON_BAD_EMAIL);
  assert.equal(personEntryProblem([{ type: 'person', phone: '+1416555' }]), MEMBER_PHONE_INCOMPLETE);
  assert.equal(personEntryProblem([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), null);
  assert.equal(personEntryProblem([{ type: 'lead', id: 7101 }]), null);
  assert.deepEqual(countableAudience(half), []);
  assert.deepEqual(countableAudience([{ type: 'person', email: 'jordan@example.com' }]), [{ type: 'person', email: 'jordan@example.com' }]);
  assert.deepEqual(countableAudience([{ type: 'all_leads' }]), [{ type: 'all_leads' }]);

  const saved = emptyDraft();
  const current = { ...saved, audience: half, subject: 'Hi' };
  assert.equal(fieldProblems(current).audience, PERSON_BAD_EMAIL);
  const { patch, held } = savableChanges(saved, current);
  assert.deepEqual(held, ['audience']);
  assert.deepEqual(patch, { subject: 'Hi' }, 'the rest still saves');
  const done = { ...saved, audience: [{ type: 'person', email: 'jordan@example.com' }] };
  assert.deepEqual(savableChanges(saved, done).patch.audience, [{ type: 'person', email: 'jordan@example.com' }]);
});

test('Estimated recipients: 1 email, 1 text, or 1 email · 1 text', () => {
  const one = { ...zero, email: 1, sms: 1 };
  assert.equal(personCountSummary(one, ['email']), '1 email');
  assert.equal(personCountSummary(one, ['sms']), '1 text');
  assert.equal(personCountSummary(one, ['email', 'sms']), '1 email · 1 text');
  assert.equal(personCountSummary({ ...zero, email: 1 }, ['email', 'sms']), '1 email · 0 texts');
  assert.equal(personCountSummary(zero, ['email']), '0 emails');
  assert.equal(personCountSummary(null, ['email']), '—');
});

test('an unsubscribed address says so (the API words, audience-count person)', () => {
  assert.equal(EMAIL_UNSUBSCRIBED, "This email address has unsubscribed, so it can't get your newsletters.");
  assert.equal(PHONE_UNSUBSCRIBED, "This phone number has unsubscribed, so it can't get your texts.");
  assert.deepEqual(personStatusProblems({ ...zero, person: { email: 'unsubscribed', sms: null } }, ['email', 'sms']), { email: EMAIL_UNSUBSCRIBED });
  assert.deepEqual(personStatusProblems({ ...zero, person: { sms: 'unsubscribed' } }, ['sms']), { phone: PHONE_UNSUBSCRIBED });
  assert.deepEqual(personStatusProblems({ ...zero, person: { email: 'unsubscribed' } }, ['sms']), {}, 'only the channels chosen');
  assert.deepEqual(personStatusProblems(zero, ['email']), {}, 'an older API without person');
  assert.deepEqual(personStatusProblems(null, ['email']), {});
});

test('Send: the person step says what is missing or unsubscribed', () => {
  const ready = {
    ...emptyDraft(), name: 'For Jordan', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca', subject: 'Hi',
    blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }],
  };
  const one = { ...zero, email: 1, sms: 1, person: { email: null, sms: null } };
  const person = (p, channels = ['email']) => ({ ...ready, channels, sms_text: channels.includes('sms') ? 'Hi' : '', audience: [{ type: 'person', ...p }] });

  assert.deepEqual(preSendProblems(person({ email: 'jordan@example.com' }), one, { mode: 'now' }), {});
  assert.equal(preSendProblems(person({ email: 'jordan@exa' }), null, { mode: 'now' }).recipients, PERSON_BAD_EMAIL);
  assert.equal(preSendProblems(person({ email: 'gone@example.com' }), { ...zero, person: { email: 'unsubscribed' } }, { mode: 'now' }).recipients, EMAIL_UNSUBSCRIBED);
  assert.equal(preSendProblems(person({ phone: '+14165550186' }, ['sms']), { ...zero, person: { sms: 'unsubscribed' } }, { mode: 'now' }).recipients, PHONE_UNSUBSCRIBED);
  assert.equal(preSendProblems({ ...ready, audience: [] }, zero, { mode: 'now' }).recipients, 'Choose who gets this newsletter.');

  assert.equal(personSendProblem([{ type: 'person', email: 'jordan@example.com' }], ['email'], one), null);
  assert.equal(personSendProblem([{ type: 'all_leads' }], ['email'], zero), null);
});

test('a person reads as their email or number in Send to and the step summary', () => {
  assert.equal(personSummary([{ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }]), 'jordan@example.com');
  assert.equal(personSummary([{ type: 'person', phone: '+14165550171' }]), '+1 416 555 0171');
  assert.equal(personSummary([]), null);
  assert.equal(personSummary([{ type: 'person', phone: '+1416555' }]), null, 'not while half typed');
  assert.equal(personEntry([{ type: 'person', email: 'a@b.co' }])?.email, 'a@b.co');
  assert.equal(personEntry([{ type: 'lead', id: 1 }]), null);
  assert.equal(audienceLabel([{ type: 'person', email: 'jordan@example.com' }], [], []), 'jordan@example.com');
  assert.equal(audienceKey({ type: 'person', email: 'jordan@example.com', phone: '+14165550171' }), 'person:jordan@example.com|+14165550171');
  assert.equal(isSinglePerson([{ type: 'person', email: 'jordan@example.com' }], true), true);
  assert.deepEqual(toggleGroupItem([{ type: 'person', email: 'jordan@example.com' }], { type: 'all_leads' }), [{ type: 'all_leads' }], 'All leads replaces the person');
});
