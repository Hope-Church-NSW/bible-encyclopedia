importScripts('assets/push-config.js');

const config = self.HOPE_PUSH_CONFIG;
const isConfigured = config
  && config.firebase
  && config.firebase.apiKey
  && config.firebase.projectId
  && config.firebase.messagingSenderId
  && config.firebase.appId;

if (isConfigured) {
  importScripts(
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js'
  );
  firebase.initializeApp(config.firebase);
  firebase.messaging().onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(notification.title || 'Hope Church NSW', {
      body: notification.body || 'The church is live now.',
      icon: 'assets/app-icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || 'church.html' }
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || 'church.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
