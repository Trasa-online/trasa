import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { useNavigate } from "react-router-dom";

// Module-level (zyje przez cala sesje JS), nie useRef. useRef reset'uje sie przy
// re-mounts (App.tsx rerenderuje sie przy nawigacji po OAuth callback), co
// powodowalo race conditions. Module-level state przezywa wszystko.
let registeredForUser: string | null = null;

// Native iOS push notifications via Capacitor APNs.
// - Wywolywany RAZ z root tree (App.tsx) gdy user logged in i isNative.
// - Web/PWA nie uzywa tego hooka - tam jest osobny usePushNotifications
//   ktory robi Service Worker + VAPID.
//
// Flow:
//   1. requestPermissions -> uzytkownik dostaje iOS prompt "Trasa would like to..."
//   2. register -> Capacitor uzyskuje APNs token z iOS
//   3. on 'registration' event -> token zapisany w push_subscriptions
//   4. on 'pushNotificationActionPerformed' -> user tapnal notyfikacje -> deep link
export function useNativePush() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    console.log("[NativePush] starting init for user", user.id.slice(0, 8));

    let removeReg: (() => void) | null = null;
    let removeRecv: (() => void) | null = null;
    let removeAction: (() => void) | null = null;

    (async () => {
      try {
        console.log("[NativePush] importing plugin...");
        const { PushNotifications } = await import("@capacitor/push-notifications");
        console.log("[NativePush] plugin imported, checking permissions...");

        const status = await PushNotifications.checkPermissions();
        console.log("[NativePush] current permission status:", status.receive);
        if (status.receive === "denied") {
          console.log("[NativePush] permission denied by user - cant register");
          return;
        }
        if (status.receive !== "granted") {
          console.log("[NativePush] requesting permission...");
          const req = await PushNotifications.requestPermissions();
          console.log("[NativePush] permission request result:", req.receive);
          if (req.receive !== "granted") {
            console.log("[NativePush] permission not granted - cant register");
            return;
          }
        }

        // Registration u APNs
        const regL = await PushNotifications.addListener("registration", async (token) => {
          console.log("[NativePush] APNs token received, len:", token.value?.length);
          if (!token.value) return;
          const { error: upsertErr } = await supabase.from("push_subscriptions" as any)
            .upsert({
              user_id: user.id,
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
        removeReg = () => regL.remove();

        await PushNotifications.addListener("registrationError", (err) => {
          console.warn("[NativePush] registration error:", JSON.stringify(err));
        });

        // Push otrzymany gdy apka jest w foreground (system NIE pokaze sam)
        const recvL = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("[NativePush] foreground received:", notification.title, notification.body);
          // TODO: opcjonalnie wyswietlić in-app toast tutaj
        });
        removeRecv = () => recvL.remove();

        // User tapnął push z lock screen / Notification Center
        const actL = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data ?? {};
          const url = (data as any).url;
          if (typeof url === "string" && url.startsWith("/")) {
            console.log("[NativePush] action -> navigate", url);
            navigate(url);
          }
        });
        removeAction = () => actL.remove();

        console.log("[NativePush] calling register() - iOS prompt should appear if first time...");
        await PushNotifications.register();
        console.log("[NativePush] register() returned - waiting for 'registration' event...");
      } catch (err: any) {
        console.error("[NativePush] init failed:", err?.message ?? err, JSON.stringify(err));
      }
    })();

    return () => {
      removeReg?.();
      removeRecv?.();
      removeAction?.();
    };
  }, [user, navigate]);
}
