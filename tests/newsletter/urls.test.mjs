import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpsUrl, toHttpsUrl, youtubeVideoId, youtubeThumbnail } from '../../components/newsletters/lib/urls.ts';

test('httpsUrl accepts only https with a real host', () => {
  assert.equal(httpsUrl('https://serpachrysler.ca/deals'), 'https://serpachrysler.ca/deals');
  assert.equal(httpsUrl(' https://serpachrysler.ca '), 'https://serpachrysler.ca/');
  assert.equal(httpsUrl('http://serpachrysler.ca'), null);
  assert.equal(httpsUrl('javascript:alert(1)'), null);
  assert.equal(httpsUrl('https://localhost'), null);
  assert.equal(httpsUrl(`https://a.ca/${'x'.repeat(2000)}`), null);
  assert.equal(httpsUrl(null), null);
  assert.equal(httpsUrl('https://a.ca/x"y'), 'https://a.ca/x%22y');
});

test('toHttpsUrl adds https:// when the scheme is missing and refuses other schemes', () => {
  assert.equal(toHttpsUrl('serpachrysler.ca/offer'), 'https://serpachrysler.ca/offer');
  assert.equal(toHttpsUrl('https://serpachrysler.ca'), 'https://serpachrysler.ca/');
  assert.equal(toHttpsUrl('http://serpachrysler.ca'), null);
  assert.equal(toHttpsUrl('ftp://serpachrysler.ca'), null);
  assert.equal(toHttpsUrl('serpachrysler.ca:8443/x'), 'https://serpachrysler.ca:8443/x');
  assert.equal(toHttpsUrl('   '), null);
});

test('youtubeVideoId reads watch, short, shorts and embed links', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://m.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://vimeo.com/123'), null);
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=short'), null);
  assert.equal(youtubeThumbnail('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

// Review fix 1: the API's isHttpsUrl refuses ' and filter_var refuses _ in a host name, and one bad link 422s the whole PUT.
test("httpsUrl encodes ' and refuses host names with _", () => {
  assert.equal(httpsUrl("https://serpachrysler.ca/it's-here"), 'https://serpachrysler.ca/it%27s-here');
  assert.equal(httpsUrl("https://a.ca/?q='x'"), 'https://a.ca/?q=%27x%27');
  assert.equal(httpsUrl('https://my_shop.serpachrysler.ca/'), null);
  assert.equal(toHttpsUrl("serpachrysler.ca/o'clock"), 'https://serpachrysler.ca/o%27clock');
  assert.equal(toHttpsUrl('my_shop.ca'), null);
  assert.equal(httpsUrl('https://a.ca/path_with_underscore'), 'https://a.ca/path_with_underscore', 'underscores in the path are fine');
});

test('youtubeVideoId accepts music.youtube.com, like the server', () => {
  assert.equal(youtubeVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
