/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// Precache all build assets (injected by vite-plugin-pwa)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// ── Push notifications ────────────────────────────────────────────────────────
// Handled here (not in a separate sw-push.js) so subscriptions are tied to
// this SW, which is the one actually active in the installed PWA.

self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    if (event.data) data = event.data.json();
  } catch {
    // ignore parse errors
  }

  const title = data.title ?? "📍 TRASA";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url ?? "/" },
    actions: [{ action: "open", title: "Otwórz" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? "/";

  event.waitUntil(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: WindowClient[]) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (self as any).clients.openWindow(url);
      })
  );
});
