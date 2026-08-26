/* The CRM service worker intentionally has no fetch cache. Business data, cookies and API responses stay network-only. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
