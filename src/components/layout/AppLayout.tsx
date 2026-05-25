import { ReactNode, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OrbOverlay from "./OrbOverlay";
import GuestWelcomeSheet from "@/components/auth/GuestWelcomeSheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface AppLayoutProps {
  children: ReactNode;
  hideTopBar?: boolean;
}

const AppLayout = ({ children, hideTopBar }: AppLayoutProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("home");

  // Global redirect po loginie - dziala dla wszystkich method logowania
  // (AuthDrawer password/OAuth/magic link, Auth.tsx page). User wybral miejsca jako
  // anon -> kliknal 'Zaplanuj trase' -> zalogowal/zarejestrowal sie -> tu lapiemy
  // transition (anon|null -> real user) i przenosimy do /plan ze step:3.
  const prevAuthRef = useRef<{ id: string | null; anon: boolean }>({ id: null, anon: true });
  useEffect(() => {
    const cur = { id: user?.id ?? null, anon: !!(user as any)?.is_anonymous };
    const prev = prevAuthRef.current;
    const justSignedIn = cur.id && !cur.anon && (prev.id !== cur.id || prev.anon);
    prevAuthRef.current = cur;
    if (!justSignedIn) return;
    try {
      const guestRaw = localStorage.getItem("trasa_guest_plan");
      if (guestRaw) {
        const guest = JSON.parse(guestRaw);
        localStorage.removeItem("trasa_guest_plan");
        navigate("/plan", { state: { step: 3, city: guest.city, date: guest.date, likedPlaceNames: guest.likedPlaceNames } });
        return;
      }
      const demoRaw = localStorage.getItem("trasa_demo_liked");
      if (demoRaw) {
        const demo = JSON.parse(demoRaw);
        localStorage.removeItem("trasa_demo_liked");
        navigate("/create", { state: { city: demo.city, likedPlacesData: demo.places } });
      }
    } catch { /* parse error - ignoruj */ }
  }, [user, navigate]);
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
      {!hideTopBar && <TopBar onOrbClick={handleOrbClick} />}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        {children}
      </main>
      <BottomNav />
      <GuestWelcomeSheet />
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
