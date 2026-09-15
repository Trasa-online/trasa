/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// Po deploy nowy SW od razu przejmuje kontrole - bez tego stary SW nadal
// serwowal stare chunki, browser pobieral nieistniejacy plik, dostawal HTML
// (SPA fallback) i wyrzucal "text/html is not a valid JavaScript MIME type".
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// NAWIGACJE: SIEC NAJPIERW (2026-09-08). Domyslnie precache oddaje powloke aplikacji
// z pamieci urzadzenia, wiec ktos, kto odwiedzil strone kilka miesiecy temu, dostawal przy
// kolejnej wizycie STARA aplikacje - zadanie w ogole nie szlo do serwera. Na trasa.travel
// znaczylo to takze, ze przekierowanie na spontaway.com sie nie wykonywalo, bo to serwer je
// robi. Widzielismy to w nagraniu: wejscie na "/" i stary kreator tras pod #/home i #/plan.
// Ta trasa musi stac PRZED precacheAndRoute - workbox dopasowuje reguly w kolejnosci rejestracji.
// Cache zostaje jako zapas na brak sieci.
registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: "app-shell", networkTimeoutSeconds: 5 })));

// Precache all build assets (injected by vite-plugin-pwa). Pliki maja skrot w nazwie, wiec
// dla NICH cache-first jest poprawny - zmiana tresci zmienia adres.
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

  const title = data.title ?? "📍 TRASA";   // i18n-ignore: tresc powiadomienia w service workerze (poza drzewem apki, brak i18n)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url ?? "/" },
    actions: [{ action: "open", title: "Otwórz" }],   // i18n-ignore: tresc powiadomienia w service workerze (poza drzewem apki, brak i18n)
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
