import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { useNavigate } from "react-router-dom";

// Module-level state - przezywa React re-mounts (App.tsx rerenderuje sie
// przy nawigacji, splash hide, OAuth callback). Bez tego useEffect cleanup
// usuwa listenery PushNotifications zanim APNs zdazy odpowiedziec.
let registeredForUser: string | null = null;
let listenersAttached = false;
// Capture'uje aktualny navigate (zeby push action mial dostep do nawigacji)
let currentNavigate: ((url: string) => void) | null = null;
// Cache user.id zeby callback registration mial do czego zapisac token
let currentUserId: string | null = null;

export function useNativePush() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Trzymaj navigate aktualne (zmienia sie przy kazdym re-render)
  useEffect(() => {
    currentNavigate = (url: string) => navigate(url);
  }, [navigate]);

  useEffect(() => {
    console.log("[NativePush] hook fired", {
      isNative,
      hasUser: !!user,
      registeredForUser,
      userId: user?.id?.slice(0, 8),
    });
    if (!isNative || !user) {
      console.log("[NativePush] early return - not native or no user");
      return;
    }
    if (registeredForUser === user.id) {
      console.log("[NativePush] early return - already registered for this user");
      return;
    }
    registeredForUser = user.id;
    currentUserId = user.id;
    console.log("[NativePush] starting init for user", user.id.slice(0, 8));

    (async () => {
      try {
        console.log("[NativePush] importing plugin...");
        const { PushNotifications } = await import("@capacitor/push-notifications");
        console.log("[NativePush] plugin imported, checking permissions...");

        const status = await PushNotifications.checkPermissions();
        console.log("[NativePush] current permission status:", status.receive);
        if (status.receive === "denied") {
          console.log("[NativePush] permission denied by user - cant register");
          registeredForUser = null;
          return;
        }
        if (status.receive !== "granted") {
          console.log("[NativePush] requesting permission...");
          const req = await PushNotifications.requestPermissions();
          console.log("[NativePush] permission request result:", req.receive);
          if (req.receive !== "granted") {
            console.log("[NativePush] permission not granted - cant register");
            registeredForUser = null;
            return;
          }
        }

        // Listenery dodajemy TYLKO RAZ na cale zycie modulu, nie per-render.
        // Cleanup w useEffect kasowal je zanim APNs zdazy odpowiedziec (token
        // przychodzi async po register(), a hook unmount sie wczesniej).
        if (!listenersAttached) {
          listenersAttached = true;

          await PushNotifications.addListener("registration", async (token) => {
            console.log("[NativePush] APNs token received, len:", token.value?.length);
            if (!token.value || !currentUserId) {
              console.warn("[NativePush] missing token or userId, skip upsert");
              return;
            }
            const { error: upsertErr } = await supabase.from("push_subscriptions" as any)
              .upsert({
                user_id: currentUserId,
                apns_token: token.value,
                platform: "ios",
                endpoint: null,
                p256dh: null,
                auth: null,
              } as any, { onConflict: "user_id,apns_token" });
            if (upsertErr) {
              console.error("[NativePush] DB upsert FAILED:", upsertErr.message, upsertErr.code);
            } else {
              console.log("[NativePush] DB upsert SUCCESS - token saved");
            }
          });

          await PushNotifications.addListener("registrationError", (err) => {
            console.warn("[NativePush] registration error:", JSON.stringify(err));
          });

          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            console.log("[NativePush] foreground received:", notification.title, notification.body);
          });

          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const data = action.notification.data ?? {};
            const url = (data as any).url;
            if (typeof url === "string" && url.startsWith("/") && currentNavigate) {
              console.log("[NativePush] action -> navigate", url);
              currentNavigate(url);
            }
          });
          console.log("[NativePush] all listeners attached (module-level, persistent)");
        } else {
          console.log("[NativePush] listeners already attached, skip");
        }

        console.log("[NativePush] calling register() - iOS prompt should appear if first time...");
        await PushNotifications.register();
        console.log("[NativePush] register() returned - waiting for 'registration' event...");
      } catch (err: any) {
        console.error("[NativePush] init failed:", err?.message ?? err, JSON.stringify(err));
        registeredForUser = null;
      }
    })();

    // NIE zwracamy cleanup - listenery musza przezyc unmount'y zeby APNs token
    // mial gdzie wrocic. Single-instance app, jeden user na raz, nie ma race.
  }, [user]);
}
