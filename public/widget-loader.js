// public/widget-loader.js
// Contact Us widget loader. Customers paste:
//   <script src="https://studio.stasht.com/widget-loader.js" data-widget-id="w_xxxxxxxxxx" async></script>
// It injects one floating iframe pointing at the embed page on the same origin the script came from.
(function () {
  'use strict';

  // currentScript is null for some async/injected loads; fall back to finding our own tag.
  var script = document.currentScript
    || document.querySelector('script[data-widget-id][src*="widget-loader.js"]');
  if (!script) return;

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
    + '&vh=' + encodeURIComponent(window.innerHeight);

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
      setStyles(next);
    }
  });

  (document.body || document.documentElement).appendChild(frame);
})();
