import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Strip markdown bold markers and collapse newlines for cleaner TTS output */
function cleanText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\n\n+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

export function useTTS() {
  const [muted, setMuted] = useState(() => localStorage.getItem("tts-muted") === "true");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (muted) return;

    stop();

    const cleaned = cleanText(text);
    if (!cleaned) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ text: cleaned }),
        }
      );

      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => {
        URL.revokeObjectURL(url);
        urlRef.current = null;
      };
    } catch (err) {
      console.error("TTS error:", err);
    }
  }, [muted, stop]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      localStorage.setItem("tts-muted", String(next));
      if (next) {
        audioRef.current?.pause();
      }
      return next;
    });
  }, []);

  return { speak, stop, muted, toggleMute };
}
