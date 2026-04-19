import { ReactNode, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OrbOverlay from "./OrbOverlay";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface AppLayoutProps {
  children: ReactNode;
}

const ELEVEN_VOICE_ID = "eXpIbVcVbLo8ZJQDlDnl";

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
