// tests/widget/widget-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeColor, safeHttpsUrl, contrastInk, hostOrigin, isPlausiblePhone, clampPosition, panelWidth, panelMaxHeight, MESSAGE_MAX,
  configUrl, ROOT_PAD,
  DEFAULT_FORM_FIELDS, formFieldsFrom, fieldLabel, isPlausibleEmail, validateValues, consentText,
  teamOnlineFrom, onlineCountText, DEFAULT_BRAND, placeholderFor, autoReplyText, initialsFrom, initialsInk,
  hasContactChoice, contactMethodLabel, fieldsForMethod, submissionValues, DEFAULT_CONTACT_METHOD,
} from '../../public/widget-core.js';

test('safeColor accepts #RRGGBB only', () => {
  assert.equal(safeColor('#2F5FAC'), '#2F5FAC');
  assert.equal(safeColor('  #2f5fac '), '#2f5fac');
  assert.equal(safeColor('red'), DEFAULT_BRAND);
  assert.equal(safeColor('#fff'), DEFAULT_BRAND);
  assert.equal(safeColor('#2f5fac; background:url(x)'), DEFAULT_BRAND);
  assert.equal(DEFAULT_BRAND, '#6C60FF');
  assert.equal(safeColor(null, '#000000'), '#000000');
});

test('safeHttpsUrl only allows https', () => {
  assert.equal(safeHttpsUrl('https://cdn.example/logo.png'), 'https://cdn.example/logo.png');
  assert.equal(safeHttpsUrl('http://cdn.example/logo.png'), null);
  assert.equal(safeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpsUrl('not a url'), null);
  assert.equal(safeHttpsUrl(undefined), null);
});

test('contrastInk picks a readable ink colour', () => {
  assert.equal(contrastInk('#ffffff'), '#111111');
  assert.equal(contrastInk('#ffd700'), '#111111');
  assert.equal(contrastInk('#2f5fac'), '#ffffff');
  assert.equal(contrastInk('#000000'), '#ffffff');
  assert.equal(contrastInk('bogus'), '#ffffff');
});

test('hostOrigin prefers the loader param, falls back to the referrer, strips paths', () => {
  assert.equal(hostOrigin({ hostParam: 'https://royalwoodshop.com', referrer: 'https://other.example/x' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: '', referrer: 'https://royalwoodshop.com/contact?a=1' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: 'garbage', referrer: 'https://royalwoodshop.com/' }), 'https://royalwoodshop.com');
  assert.equal(hostOrigin({ hostParam: null, referrer: '' }), '');
});

test('isPlausiblePhone mirrors the server rule', () => {
  for (const ok of ['(416) 818-1235', '4168181235', '1 416 818 1235', '+1 416 818 1235', '+44 20 7946 0958']) {
    assert.equal(isPlausiblePhone(ok), true, ok);
  }
  for (const bad of ['', '12345', 'abc', '416818123', '24168181235', '+1234567']) {
    assert.equal(isPlausiblePhone(bad), false, bad);
  }
});

test('clampPosition defaults to bottom-right', () => {
  assert.equal(clampPosition('bottom-left'), 'bottom-left');
  assert.equal(clampPosition('bottom-right'), 'bottom-right');
  assert.equal(clampPosition('top'), 'bottom-right');
  assert.equal(clampPosition(undefined), 'bottom-right');
});

test('panel plus its shadow padding fits inside the loader-capped iframe (vw - 32 wide)', () => {
  assert.equal(panelWidth(undefined), 420);
  assert.equal(panelWidth(0), 420);
  assert.equal(panelWidth(1440), 420);
  assert.equal(panelWidth(400), 336);
  assert.equal(panelWidth(320), 256);
  assert.equal(panelWidth(250), 240);
  for (const vw of [360, 390, 400, 430]) {
    assert.ok(panelWidth(vw) + ROOT_PAD.x * 2 <= vw - 32, `fits at ${vw}px`);
  }
});

test('MESSAGE_MAX matches the API limit', () => {
  assert.equal(MESSAGE_MAX, 320);
});

test('panelMaxHeight leaves room for the shadow padding inside the loader-capped iframe', () => {
  assert.equal(panelMaxHeight(undefined), 684);
  assert.equal(panelMaxHeight(0), 684);
  assert.equal(panelMaxHeight(900), 684);
  assert.equal(panelMaxHeight(640), 572);
  assert.equal(panelMaxHeight(568), 500);
  assert.equal(panelMaxHeight(200), 200);
  for (const vh of [568, 640, 900]) {
    assert.ok(panelMaxHeight(vh) + ROOT_PAD.top + ROOT_PAD.bottom <= Math.min(720, vh - 32), `fits at ${vh}px`);
  }
});

test('the panel shadow stays inside the padding, so the iframe edge never cuts it off', () => {
  // PANEL_SHADOW's largest layer is 0 8px 20px -6px: reaches blur + spread + offset from each edge.
  const reach = { top: 20 - 6 - 8, x: 20 - 6, bottom: 20 - 6 + 8 };
  assert.ok(ROOT_PAD.top >= reach.top && ROOT_PAD.x >= reach.x && ROOT_PAD.bottom >= reach.bottom);
});

test('configUrl passes the customer page origin so the server can record where the widget is installed', () => {
  const api = 'https://restapi.stasht.com/api/react';
  assert.equal(
    configUrl(api, 'w_abcdefghij', 'https://www.example.com'),
    'https://restapi.stasht.com/api/react/widget-embed/w_abcdefghij/config?host=https%3A%2F%2Fwww.example.com',
  );
  assert.equal(configUrl(api, 'w_abcdefghij', ''), 'https://restapi.stasht.com/api/react/widget-embed/w_abcdefghij/config');
});

const EMAIL_ONLY = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'message', label: 'Message', required: false },
];

test('formFieldsFrom uses the configured fields, or the original form for older API responses', () => {
  assert.deepEqual(formFieldsFrom({}), DEFAULT_FORM_FIELDS);
  assert.deepEqual(DEFAULT_FORM_FIELDS.map((f) => f.key), ['name', 'mobile', 'company', 'message']);
  assert.deepEqual(formFieldsFrom({ form_fields: EMAIL_ONLY }), EMAIL_ONLY);
  assert.deepEqual(
    formFieldsFrom({ form_fields: [{ key: 'email', label: '', required: 1 }, { key: 'evil', label: 'x', required: true }] }),
    [{ key: 'email', label: 'Email', required: true }],
  );
});

test('fieldLabel marks optional fields', () => {
  assert.equal(fieldLabel({ key: 'company', label: 'Dealership', required: false }), 'Dealership (optional)');
  assert.equal(fieldLabel({ key: 'name', label: 'Name', required: true }), 'Name');
});

test('isPlausibleEmail is a light early check (the server is authoritative)', () => {
  assert.ok(isPlausibleEmail('sam@example.com'));
  assert.ok(!isPlausibleEmail('sam@example'));
  assert.ok(!isPlausibleEmail('not an email'));
});

test('validateValues checks only the shown fields: required ones filled, contact details well-formed', () => {
  assert.deepEqual(validateValues(EMAIL_ONLY, { name: 'Sam', email: 'sam@example.com', message: '' }), {});
  assert.deepEqual(validateValues(EMAIL_ONLY, { name: '', email: 'nope', mobile: 'ignored' }), {
    name: 'Enter your name.', email: 'Enter a valid email address.',
  });
  assert.deepEqual(validateValues(DEFAULT_FORM_FIELDS, { name: 'Sam', mobile: '123', message: 'Hi' }), {
    mobile: 'Enter a valid phone number, including the area code.',
  });
  const optionalMobile = [{ key: 'mobile', label: 'Mobile', required: false }, { key: 'email', label: 'Email', required: true }];
  assert.deepEqual(validateValues(optionalMobile, { mobile: '', email: 'sam@example.com' }), {});
});

const CHOICE = [
  { key: 'name', label: 'Name', required: true },
  { key: 'mobile', label: 'Mobile Number', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'message', label: 'Message', required: true },
];

test('hasContactChoice: mobile and email both shown', () => {
  assert.ok(hasContactChoice(CHOICE));
  assert.ok(!hasContactChoice(DEFAULT_FORM_FIELDS));
  assert.ok(!hasContactChoice(EMAIL_ONLY));
  assert.equal(DEFAULT_CONTACT_METHOD, 'mobile');
});

test('contactMethodLabel says "Mobile phone" / "Email", or the owner\'s own label', () => {
  assert.equal(contactMethodLabel(CHOICE[1]), 'Mobile phone');
  assert.equal(contactMethodLabel(CHOICE[2]), 'Email');
  assert.equal(contactMethodLabel({ key: 'mobile', label: 'Cell', required: false }), 'Cell');
  assert.equal(contactMethodLabel({ key: 'email', label: 'Work email', required: false }), 'Work email');
});

test('fieldsForMethod keeps only the chosen contact field, required; one-field forms are unchanged', () => {
  assert.deepEqual(fieldsForMethod(CHOICE, 'mobile').map((f) => [f.key, f.required]),
    [['name', true], ['mobile', true], ['message', true]]);
  assert.deepEqual(fieldsForMethod(CHOICE, 'email').map((f) => [f.key, f.required]),
    [['name', true], ['email', true], ['message', true]]);
  assert.deepEqual(fieldsForMethod(CHOICE, 'nonsense').map((f) => f.key), ['name', 'mobile', 'message']);
  assert.equal(fieldsForMethod(DEFAULT_FORM_FIELDS, 'email'), DEFAULT_FORM_FIELDS);
  assert.equal(fieldsForMethod(EMAIL_ONLY, 'mobile'), EMAIL_ONLY);
  assert.equal(CHOICE[1].required, false, 'the config is not mutated');
});

test('the chosen contact field is required and checked; the other is ignored', () => {
  const values = { name: 'Sam', mobile: '', email: 'nope', message: 'Hi' };
  assert.deepEqual(validateValues(fieldsForMethod(CHOICE, 'mobile'), values), {
    mobile: 'Enter a valid phone number, including the area code.',
  });
  assert.deepEqual(validateValues(fieldsForMethod(CHOICE, 'email'), values), { email: 'Enter a valid email address.' });
  assert.deepEqual(validateValues(fieldsForMethod(CHOICE, 'mobile'), { ...values, mobile: '416 818 1235' }), {});
});

test('submissionValues sends only the chosen contact value', () => {
  const values = { name: ' Sam ', mobile: '416 818 1235', email: 'sam@example.com', company: 'x', message: 'Hi' };
  assert.deepEqual(submissionValues(CHOICE, values, 'mobile'), { name: 'Sam', mobile: '416 818 1235', message: 'Hi' });
  assert.deepEqual(submissionValues(CHOICE, values, 'email'), { name: 'Sam', email: 'sam@example.com', message: 'Hi' });
  assert.deepEqual(submissionValues(DEFAULT_FORM_FIELDS, values, 'email'),
    { name: 'Sam', mobile: '416 818 1235', company: 'x', message: 'Hi' });
});

test('consentText is the design copy', () => {
  assert.equal(consentText(), 'By submitting you agree to receive messages for the provided channel. Rates may be applied.');
});

test('placeholderFor puts the label in the input, marking required and optional fields', () => {
  assert.equal(placeholderFor({ key: 'name', label: 'Name', required: true }), 'Name *');
  assert.equal(placeholderFor({ key: 'company', label: 'Business', required: false }), 'Business (optional)');
  assert.equal(placeholderFor({ key: 'message', label: 'Message', required: true }), 'I want to know more...');
  assert.equal(placeholderFor({ key: 'message', label: 'Your question', required: true }), 'Your question *');
});

test('autoReplyText greets by first name', () => {
  assert.equal(autoReplyText('christian beckermann'), "Hi christian! Thanks for reaching out. We've got your message and will reply shortly.");
  assert.equal(autoReplyText(''), "Hi! Thanks for reaching out. We've got your message and will reply shortly.");
});

test('initialsFrom makes two-letter initials', () => {
  assert.equal(initialsFrom('Christian Beckermann'), 'CB');
  assert.equal(initialsFrom('sam'), 'S');
  assert.equal(initialsFrom('  '), '?');
});

test('teamOnlineFrom keeps up to four safe entries', () => {
  const team = teamOnlineFrom({ team_online: [
    { name: 'Sam', avatar_url: 'https://cdn.example/sam.jpg', initials: 'SC', color: '#10B981' },
    { name: 'Andrew', avatar_url: 'http://cdn.example/a.jpg', initials: 'AVD', color: 'red' },
    { name: '', initials: 'X' },
    { name: 'Jo', avatar_url: null, initials: 'JO', color: '#123456' },
    { name: 'Kim', initials: 'K', color: '#654321' },
  ] });
  assert.deepEqual(team, [
    { name: 'Sam', avatarUrl: 'https://cdn.example/sam.jpg', initials: 'SC', color: '#10B981' },
    { name: 'Andrew', avatarUrl: null, initials: 'AV', color: '#6C60FF' },
    { name: 'Jo', avatarUrl: null, initials: 'JO', color: '#123456' },
    { name: 'Kim', avatarUrl: null, initials: 'K', color: '#654321' },
  ]);
  assert.deepEqual(teamOnlineFrom({}), []);
  assert.deepEqual(teamOnlineFrom({ team_online: 'nope' }), []);
  assert.deepEqual(teamOnlineFrom(null), []);
});

test('onlineCountText counts who is online', () => {
  assert.equal(onlineCountText([{ name: 'Sam' }, { name: 'Jo' }, { name: 'Kim' }, { name: 'Lee' }]), '4 online');
});

test('initialsInk keeps initials white except on very pale colours', () => {
  assert.equal(initialsInk('#F59E0B'), '#ffffff');
  assert.equal(initialsInk('#6C60FF'), '#ffffff');
  assert.equal(initialsInk('#FEF3C7'), '#1f2937');
});

test('powered-by link goes to stasht.com over https, tagged as a widget referral', async () => {
  const { POWERED_BY_URL, STASHT_MARK_PATH, STASHT_MARK_VIEWBOX } = await import('../../public/widget-core.js');
  const u = new URL(POWERED_BY_URL);
  assert.equal(u.protocol, 'https:');
  assert.equal(u.hostname, 'stasht.com');
  assert.equal(u.searchParams.get('utm_source'), 'contact-widget');
  assert.match(STASHT_MARK_PATH, /^M[\d.,\-a-zA-Z\s]+Z$/);
  assert.equal(STASHT_MARK_VIEWBOX, '0 0 78.99 52.48');
});
