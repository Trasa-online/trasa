import { ReactNode, useRef, useState } from "react";
import TopBar from "./TopBar";
import OrbOverlay from "./OrbOverlay";

interface AppLayoutProps {
  children: ReactNode;
}

const ELEVEN_VOICE_ID = "eXpIbVcVbLo8ZJQDlDnl";
const GREETING = "W czym mogę Ci pomóc?";

const AppLayout = ({ children }: AppLayoutProps) => {
  const [showOrbOverlay, setShowOrbOverlay] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleOrbClick = async () => {
    setShowOrbOverlay(true);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const elKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (!elKey) return;
    try {
      setIsSpeaking(true);
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: GREETING, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const handleClose = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsSpeaking(false);
    setShowOrbOverlay(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar onOrbClick={handleOrbClick} />
      <main className="max-w-lg mx-auto">
        {children}
      </main>
      {showOrbOverlay && <OrbOverlay isSpeaking={isSpeaking} onClose={handleClose} />}
    </div>
  );
};

export default AppLayout;
