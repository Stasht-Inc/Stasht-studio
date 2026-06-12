// Service Worker for Push Notifications
console.log('🔧 Service Worker loaded');

// Listen for push events
self.addEventListener('push', function(event) {
  console.log('📬 Push notification received:', event);

  if (!event.data) {
    console.log('❌ Push event but no data');
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
    console.log('📦 Notification data:', notificationData);
  } catch (e) {
    console.error('❌ Error parsing notification data:', e);
    notificationData = {
      title: 'New Notification',
      body: event.data.text() || 'You have a new notification'
    };
  }

  const title = notificationData.title || 'New Notification';
  const options = {
    body: notificationData.body || '',
    icon: notificationData.icon || '/logo.png',
    badge: notificationData.badge || '/badge.png',
    data: notificationData.data || {},
    tag: 'notification-' + (notificationData.data?.notificationId || Date.now()),
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listen for notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('🖱️ Notification clicked:', event.notification);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === self.location.origin + urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Listen for service worker installation
self.addEventListener('install', function(event) {
  console.log('✅ Service Worker installed');
  self.skipWaiting();
});

// Listen for service worker activation
self.addEventListener('activate', function(event) {
  console.log('✅ Service Worker activated');
  event.waitUntil(clients.claim());
});
