import { ReactNode, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OrbOverlay from "./OrbOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface AppLayoutProps {
  children: ReactNode;
}

const GUEST_BANNER_DISMISS_KEY = "trasa_guest_banner_dismissed";

const GuestBanner = () => {
  const { open } = useAuthDrawer();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(GUEST_BANNER_DISMISS_KEY) === "1"; } catch { return false; }
  });
  if (dismissed) return null;
  return (
    <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2.5">
      <p className="flex-1 text-xs text-foreground leading-snug">
        Grasz jako gość. Załóż konto, żeby zapisywać trasy{` `}i&nbsp;mieć dziennik.
      </p>
      <button
        onClick={() => open({ mode: "register" })}
        className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold active:scale-95 transition-transform shadow-sm shadow-orange-500/20"
      >
        Załóż konto
      </button>
      <button
        onClick={() => {
          try { sessionStorage.setItem(GUEST_BANNER_DISMISS_KEY, "1"); } catch { /* sessionStorage unavailable */ }
          setDismissed(true);
        }}
        className="shrink-0 h-6 w-6 -mr-1 flex items-center justify-center text-orange-700/50 active:text-orange-700"
        aria-label="Ukryj baner gościa"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user } = useAuth();
  const { t } = useTranslation("home");
  const { data: profile } = useQuery({
    queryKey: ["profile-topbar", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("username, dietary_prefs, travel_interests").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: activeRoutes } = useQuery({
    queryKey: ["active-routes-orb", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("id, city, folder_id, day_number")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const [showOrbOverlay, setShowOrbOverlay] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const handleOrbClick = async () => {
    const greeting = profile?.username
      ? t("greeting_with_name", { name: profile.username })
      : t("greeting");
    setShowOrbOverlay(true);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }

    // ElevenLabs disabled
  };

  const handleClose = () => {
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setIsSpeaking(false);
    setShowOrbOverlay(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar onOrbClick={handleOrbClick} />
      {!user && <GuestBanner />}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
      {showOrbOverlay && (
        <OrbOverlay
          isSpeaking={isSpeaking}
          onClose={handleClose}
          activeRoutes={activeRoutes ?? []}
          userInterests={[...(profile?.dietary_prefs ?? []), ...(profile?.travel_interests ?? [])]}
        />
      )}
    </div>
  );
};

export default AppLayout;
