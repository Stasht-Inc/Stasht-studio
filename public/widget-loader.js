// public/widget-loader.js
// Contact Us widget loader. Customers paste:
//   <script src="https://studio.stasht.com/widget-loader.js" data-widget-id="w_xxxxxxxxxx" async></script>
// It injects one floating iframe pointing at the embed page on the same origin the script came from.
(function () {
  'use strict';

  // Front end only (Chris, 2026-10-06): a site whose admin pages share the template the snippet was
  // pasted into must not get the widget there. Checked before anything else: no frame, no request.
  // Per-widget pages ("Don't show on these pages") are checked by the embed, which has the config.
  // <admin-skip> Copied verbatim from widget-core.js (tests/widget/widget-paths.test.mjs checks they match).
  var ADMIN_PATH_SEGMENTS = ['admin', 'wp-admin', 'administrator', 'wp-login.php'];

  function isAdminPath(pathname) {
    if (typeof pathname !== 'string') return false;
    var first = pathname.split('/')[1] || '';
    try { first = decodeURIComponent(first); } catch (e) { /* malformed escape: compare as is */ }
    return ADMIN_PATH_SEGMENTS.indexOf(first.toLowerCase()) !== -1;
  }
  // </admin-skip>
  if (isAdminPath(window.location.pathname)) return;

  // currentScript is null for some async/injected loads; fall back to finding our own tag.
  var script = document.currentScript
    || document.querySelector('script[data-widget-id][src*="widget-loader.js"]');
  if (!script) return;
  // An app that injects this tag and removes it again before it runs (e.g. Studio's login page
  // unmounting) means "don't install": otherwise the widget would appear after the page is gone.
  if (script.isConnected === false) return;

  var scriptSrc = script.getAttribute('src');
  if (!scriptSrc) return; // inline script with no src: nothing to derive our origin from

  var widgetId = script.getAttribute('data-widget-id');
  if (!widgetId || !/^w_[a-z0-9]{10}$/.test(widgetId)) return;

  var frameId = 'stasht-widget-' + widgetId;
  if (document.getElementById(frameId)) return; // already installed on this page

  var base;
  try { base = new URL(script.src, window.location.href).origin; } catch (e) { return; }
  var src = base + '/widget-embed.html'
    + '?w=' + encodeURIComponent(widgetId)
    + '&host=' + encodeURIComponent(window.location.origin)
    + '&vw=' + encodeURIComponent(window.innerWidth)
    + '&vh=' + encodeURIComponent(window.innerHeight)
    + '&path=' + encodeURIComponent(window.location.pathname);

  var frame = document.createElement('iframe');
  frame.id = frameId;
  frame.src = src;
  frame.title = 'Contact us';
  frame.setAttribute('scrolling', 'auto');
  // Hidden and zero-sized until the embed page reports how big it wants to be. Applied with
  // !important so host-page CSS (e.g. `iframe { border: 1px solid }`) can't override the essentials.
  var styles = {
    'position': 'fixed', 'bottom': '16px', 'right': '16px', 'width': '0', 'height': '0', 'border': '0',
    'background': 'transparent', 'z-index': '2147483000', 'color-scheme': 'normal',
    'max-width': 'calc(100vw - 32px)', 'max-height': 'calc(100vh - 32px)', 'visibility': 'hidden'
  };
  function setStyles(map) {
    for (var k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) frame.style.setProperty(k, map[k], 'important');
    }
  }
  setStyles(styles);

  // Click-through (wdy2xh1tjc): the embed reports its visible parts ("hit rects") and the iframe is
  // clipped to them, so the transparent rest of its rectangle no longer swallows the host page's
  // clicks. No rects (an older cached embed) or no clip-path path() support: no clip, as before.
  var canClip = false;
  try { canClip = !!(window.CSS && CSS.supports && CSS.supports('clip-path', "path('M0 0H1V1H0Z')")); } catch (e) { /* no clip */ }

  // <hit-area> Copied verbatim from widget-core.js (tests/widget/widget-core.test.mjs checks they match).
  function sanitizeHitRects(raw, frameW, frameH) {
    var MAX = 6;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX) return null;
    var W = frameW, H = frameH;
    if (typeof W !== 'number' || typeof H !== 'number' || !(W > 0) || !(H > 0) || !isFinite(W) || !isFinite(H)) return null;
    var num = function (n) { return typeof n === 'number' && isFinite(n); };
    var clamp = function (n, max) { return Math.max(0, Math.min(max, n)); };
    var round = function (n) { return Math.round(n * 100) / 100; };
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var r = raw[i];
      if (!r || typeof r !== 'object') return null;
      var rad = r.r === undefined ? 0 : r.r;
      if (!num(r.x) || !num(r.y) || !num(r.w) || !num(r.h) || !num(rad) || r.w < 0 || r.h < 0) return null;
      var x0 = clamp(r.x, W), y0 = clamp(r.y, H), x1 = clamp(r.x + r.w, W), y1 = clamp(r.y + r.h, H);
      if (x1 - x0 < 1 || y1 - y0 < 1) continue; // nothing of it inside the frame
      out.push({
        x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0),
        r: round(Math.max(0, Math.min(rad, (x1 - x0) / 2, (y1 - y0) / 2))),
      });
    }
    return out.length ? out : null;
  }

  function hitClipPath(rects) {
    var f = function (n) { return String(Math.round(n * 100) / 100); };
    var d = [];
    for (var i = 0; i < rects.length; i++) {
      var x = rects[i].x, y = rects[i].y, w = rects[i].w, h = rects[i].h, r = rects[i].r || 0;
      if (r > 0) {
        var a = 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ';
        d.push('M' + f(x + r) + ' ' + f(y) + 'H' + f(x + w - r) + a + f(x + w) + ' ' + f(y + r)
          + 'V' + f(y + h - r) + a + f(x + w - r) + ' ' + f(y + h)
          + 'H' + f(x + r) + a + f(x) + ' ' + f(y + h - r)
          + 'V' + f(y + r) + a + f(x + r) + ' ' + f(y) + 'Z');
      } else {
        d.push('M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'V' + f(y + h) + 'H' + f(x) + 'Z');
      }
    }
    return "path('" + d.join(' ') + "')";
  }
  // </hit-area>

  window.addEventListener('message', function (event) {
    // Only accept messages from our own iframe.
    if (event.origin !== base || event.source !== frame.contentWindow) return;
    var msg = event.data;
    if (!msg || msg.source !== 'stasht-widget' || msg.id !== widgetId) return;

    if (msg.type === 'hide') {
      frame.remove();
      return;
    }

    if (msg.type === 'resize') {
      var width = Math.max(0, Math.min(Number(msg.width) || 0, 480));
      var height = Math.max(0, Math.min(Number(msg.height) || 0, 720));
      var next = { 'width': width + 'px', 'height': height + 'px', 'visibility': 'visible' };
      if (msg.position === 'bottom-left') {
        next.left = '16px';
        next.right = 'auto';
      } else {
        next.right = '16px';
        next.left = 'auto';
      }
      var rects = canClip ? sanitizeHitRects(msg.hit, width, height) : null;
      if (rects) next['clip-path'] = hitClipPath(rects);
      else frame.style.removeProperty('clip-path');
      setStyles(next);
    }
  });

  (document.body || document.documentElement).appendChild(frame);
})();
