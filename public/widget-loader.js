// public/widget-loader.js
// Contact Us widget loader. Customers paste:
//   <script src="https://studio.stasht.com/widget-loader.js" data-widget-id="w_xxxxxxxxxx" async></script>
// It injects one floating iframe pointing at the embed page on the same origin the script came from.
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var widgetId = script.getAttribute('data-widget-id');
  if (!widgetId || !/^w_[a-z0-9]{10}$/.test(widgetId)) return;

  var frameId = 'stasht-widget-' + widgetId;
  if (document.getElementById(frameId)) return; // already installed on this page

  var base = new URL(script.src).origin;
  var src = base + '/widget-embed.html'
    + '?w=' + encodeURIComponent(widgetId)
    + '&host=' + encodeURIComponent(window.location.origin)
    + '&vw=' + encodeURIComponent(window.innerWidth);

  var frame = document.createElement('iframe');
  frame.id = frameId;
  frame.src = src;
  frame.title = 'Contact us';
  frame.setAttribute('scrolling', 'auto');
  // Hidden and zero-sized until the embed page reports how big it wants to be.
  frame.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'width:0', 'height:0', 'border:0',
    'background:transparent', 'z-index:2147483000', 'color-scheme:normal',
    'max-width:calc(100vw - 32px)', 'max-height:calc(100vh - 32px)', 'visibility:hidden'
  ].join(';');

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
      frame.style.width = width + 'px';
      frame.style.height = height + 'px';
      if (msg.position === 'bottom-left') {
        frame.style.left = '16px';
        frame.style.right = 'auto';
      } else {
        frame.style.right = '16px';
        frame.style.left = 'auto';
      }
      frame.style.visibility = 'visible';
    }
  });

  (document.body || document.documentElement).appendChild(frame);
})();
