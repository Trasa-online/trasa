import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Mic, MicOff, Camera, MapPin, Coffee, Utensils, Map, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

interface ActiveRoute {
  id: string;
  city: string;
  folder_id: string | null;
  day_number: number | null;
}

interface PlaceResult {
  name: string;
  description: string;
  tip: string;
}

interface Chip {
  label: string;
  query: string;
  icon?: React.ReactNode;
  action?: () => void;
}

interface OrbOverlayProps {
  onClose: () => void;
  isSpeaking?: boolean;
  activeRoutes?: ActiveRoute[];
  userInterests?: string[];
}

const OrbOverlay = ({ onClose, isSpeaking = false, activeRoutes = [], userInterests = [] }: OrbOverlayProps) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const { t: tHome } = useTranslation("home");
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [placeResult, setPlaceResult] = useState<PlaceResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInput(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSubmit = (query?: string) => {
    const q = (query ?? message).trim();
    if (!q) return;
    onClose();
    navigate(`/create?q=${encodeURIComponent(q)}`);
  };

  const handleToggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec: new () => any = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRec) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = i18n.language === "en" ? "en-US" : "pl-PL";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMessage(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handlePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsIdentifying(true);
    setPlaceResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data URL prefix
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("identify-place", {
        body: { imageBase64: base64, mimeType: file.type || "image/jpeg", language: i18n.language },
      });

      if (error) throw error;
      setPlaceResult(data as PlaceResult);
    } catch {
      setPlaceResult({
        name: i18n.language === "en" ? "Unknown place" : "Nieznane miejsce",
        description: i18n.language === "en" ? "Could not identify the place." : "Nie udało się rozpoznać miejsca.",
        tip: "",
      });
    } finally {
      setIsIdentifying(false);
    }
  };

  // Build contextual chips
  const chips: Chip[] = [];

  // Active trip chips
  if (activeRoutes.length > 0) {
    const route = activeRoutes[0];
    chips.push({
      label: tHome("chip_edit_plan", { city: route.city }),
      query: "",
      icon: <MapPin className="h-3 w-3" />,
      action: () => {
        onClose();
        navigate(`/create?routeId=${route.id}`);
      },
    });
  }

  // Interest-based chips
  const interestSet = new Set(userInterests.map((i) => i.toLowerCase()));
  if (interestSet.has("coffee") || interestSet.has("kawa")) {
    chips.push({ label: tHome("chip_cafe"), query: tHome("chip_cafe_query"), icon: <Coffee className="h-3 w-3" /> });
  }
  if (interestSet.has("food") || interestSet.has("jedzenie") || interestSet.has("restaurants") || interestSet.has("restauracje")) {
    chips.push({ label: tHome("chip_restaurant"), query: tHome("chip_restaurant_query"), icon: <Utensils className="h-3 w-3" /> });
  }

  // Generic fallbacks — always show at least 2 chips
  chips.push({ label: tHome("chip_sightseeing"), query: tHome("chip_sightseeing_query"), icon: <Map className="h-3 w-3" /> });

  const visibleChips = chips.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 p-2 text-muted-foreground hover:text-foreground"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        aria-label={t("buttons.close")}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Orb animates in from TopBar */}
      <div className={cn("h-32 w-32 rounded-full orb-gradient orb-emerge mb-8", isSpeaking && "orb-speaking")} />

      {/* Input fades in after orb lands */}
      <div
        className={cn(
          "w-full max-w-sm transition-all duration-500 flex flex-col gap-4",
          showInput ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <p className="text-2xl font-bold tracking-tight text-center">
          {tHome("orb_question")}
        </p>

        {/* Contextual chips */}
        <div className="flex gap-2 flex-wrap justify-center">
          {visibleChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                if (chip.action) {
                  chip.action();
                } else {
                  handleSubmit(chip.query);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:bg-muted active:scale-95 transition-transform"
            >
              {chip.icon}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Place identification result */}
        {isIdentifying && (
          <div className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">{tHome("identifying_place")}</span>
          </div>
        )}
        {placeResult && !isIdentifying && (
          <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-1">
            <p className="font-semibold text-sm">{placeResult.name}</p>
            <p className="text-xs text-muted-foreground">{placeResult.description}</p>
            {placeResult.tip && (
              <p className="text-xs text-muted-foreground mt-1">💡 {placeResult.tip}</p>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-center">
          {/* Mic button */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={cn(
              "h-11 w-11 rounded-full border border-border flex items-center justify-center shrink-0 active:scale-90 transition-transform",
              isListening ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card text-muted-foreground hover:text-foreground"
            )}
            aria-label={isListening ? t("buttons.stop_recording") : t("buttons.start_recording")}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={tHome("orb_placeholder")}
            className="flex-1 bg-card border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Camera button */}
          <button
            type="button"
            onClick={handlePhoto}
            disabled={isIdentifying}
            className="h-11 w-11 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-40"
            aria-label={tHome("identify_place")}
          >
            <Camera className="h-4 w-4" />
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!message.trim()}
            className="h-11 w-11 rounded-full orb-gradient disabled:opacity-30 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default OrbOverlay;
