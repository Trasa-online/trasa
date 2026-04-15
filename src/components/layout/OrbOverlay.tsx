import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Mic, MicOff, Camera, MapPin, Coffee, Utensils, Map, Loader2, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ActiveRoute {
  id: string;
  city: string;
  folder_id: string | null;
  day_number: number | null;
}

interface PlaceResult {
  found?: boolean;
  name: string;
  description: string;
  tip: string;
}

interface PlaceCard {
  name: string;
  address: string;
  description: string;
  category: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", bar: "🍺",
  nightlife: "🎶", monument: "🏰", walk: "🚶", park: "🌿",
  shopping: "🛍️", church: "⛪", gallery: "🖼️", market: "🏪",
};

const OrbOverlay = ({ onClose, isSpeaking = false, activeRoutes = [], userInterests = [] }: OrbOverlayProps) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("common");
  const { t: tHome } = useTranslation("home");
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [placeResult, setPlaceResult] = useState<PlaceResult | null>(null);
  const [showSightseeingCategories, setShowSightseeingCategories] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatPlaces, setChatPlaces] = useState<PlaceCard[]>([]);
  const [addedPlaces, setAddedPlaces] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const submitRef = useRef<(text?: string) => void>(() => {});

  const inChatMode = chatMessages.length > 0 || chatLoading;
  const isOrbActive = isSpeaking || chatLoading;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInput(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // ── Submit: if message looks like a plan request → navigate, else → chat
  const handleSubmit = useCallback(async (query?: string) => {
    const q = (query ?? message).trim();
    if (!q || chatLoading) return;
    setMessage("");

    // Detect full-plan intent keywords → navigate as before
    const planKeywords = /(\d+\s*dni|\d+\s*day|zaplanuj mi|plan na|plan for|trip to|wycieczka do)/i;
    if (planKeywords.test(q) && chatMessages.length === 0) {
      onClose();
      navigate(`/create?q=${encodeURIComponent(q)}`);
      return;
    }

    // Otherwise → chat mode
    const newHistory: ChatMessage[] = [...chatMessages, { role: "user", content: q }];
    setChatMessages(newHistory);
    setChatPlaces([]);
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("orb-chat", {
        body: {
          message: q,
          messages: chatMessages, // history without the new message (server appends it)
          city: activeRoutes[0]?.city,
        },
      });

      if (error) throw error;

      setChatMessages(prev => [...prev, { role: "assistant", content: data.message ?? "" }]);
      if (Array.isArray(data.places) && data.places.length > 0) {
        setChatPlaces(data.places);
      }
    } catch (err) {
      console.error("orb-chat error:", err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Przepraszam, coś poszło nie tak. Spróbuj ponownie." }]);
    } finally {
      setChatLoading(false);
    }
  }, [message, chatMessages, chatLoading, activeRoutes, navigate, onClose]);

  // Keep ref up to date for voice callback
  submitRef.current = handleSubmit;

  const handleAddPlace = async (place: PlaceCard) => {
    const activeRoute = activeRoutes[0];
    if (!activeRoute) {
      toast.error("Brak aktywnej trasy. Stwórz plan podróży.");
      return;
    }

    try {
      const { data: existingPins } = await supabase
        .from("pins")
        .select("pin_order")
        .eq("route_id", activeRoute.id)
        .order("pin_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingPins?.[0]?.pin_order ?? 0) + 1;

      const { error } = await supabase.from("pins").insert({
        route_id: activeRoute.id,
        place_name: place.name,
        address: place.address,
        description: place.description,
        category: place.category,
        pin_order: nextOrder,
      });

      if (error) throw error;

      setAddedPlaces(prev => new Set(prev).add(place.name));
      toast.success(`${place.name} dodano do trasy!`);
    } catch (err) {
      console.error("Add place error:", err);
      toast.error("Nie udało się dodać miejsca.");
    }
  };

  const handleToggleVoice = () => {
    const w = window as any;
    const SpeechRec: new () => any = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = i18n.language === "en" ? "en-US" : "pl-PL";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
      setMessage(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        setMessage("");
        setIsListening(false);
        setTimeout(() => submitRef.current(transcript), 300);
      }
    };
    recognition.onerror = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handlePhoto = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsIdentifying(true);
    setPlaceResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
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

  // Build chips
  const chips: Chip[] = [];
  if (activeRoutes.length > 0) {
    const route = activeRoutes[0];
    chips.push({
      label: tHome("chip_edit_plan", { city: route.city }),
      query: "",
      icon: <MapPin className="h-3 w-3" />,
      action: () => { onClose(); navigate(`/edit-plan?route=${route.id}`); },
    });
  }
  const interestSet = new Set(userInterests.map(i => i.toLowerCase()));
  if (interestSet.has("coffee") || interestSet.has("kawa"))
    chips.push({ label: tHome("chip_cafe"), query: tHome("chip_cafe_query"), icon: <Coffee className="h-3 w-3" /> });
  if (interestSet.has("food") || interestSet.has("jedzenie") || interestSet.has("restaurants") || interestSet.has("restauracje"))
    chips.push({ label: tHome("chip_restaurant"), query: tHome("chip_restaurant_query"), icon: <Utensils className="h-3 w-3" /> });
  chips.push({
    label: tHome("chip_sightseeing"),
    query: "",
    icon: <Map className="h-3 w-3" />,
    action: () => setShowSightseeingCategories(true),
  });
  const visibleChips = chips.slice(0, 4);

  const sightseeingCategories = i18n.language === "en"
    ? [
        { label: "Monuments", emoji: "🏰", query: "Show me 3 interesting monuments and landmarks" },
        { label: "Museums", emoji: "🏛️", query: "Show me 3 interesting museums" },
        { label: "Parks", emoji: "🌳", query: "Show me 3 beautiful parks and places for a walk" },
        { label: "Restaurants", emoji: "🍽️", query: "Recommend 3 restaurants" },
        { label: "Cafés", emoji: "☕", query: "Recommend 3 cafés" },
      ]
    : [
        { label: "Zabytki", emoji: "🏰", query: "Pokaż mi 3 najciekawsze zabytki" },
        { label: "Muzea", emoji: "🏛️", query: "Pokaż mi 3 interesujące muzea" },
        { label: "Parki", emoji: "🌳", query: "Pokaż mi 3 najpiękniejsze parki i miejsca na spacer" },
        { label: "Restauracje", emoji: "🍽️", query: "Polecisz mi 3 restauracje?" },
        { label: "Kawiarnie", emoji: "☕", query: "Polecisz mi 3 kawiarnie?" },
      ];

  const handleSightseeingCategory = (baseQuery: string) => {
    const activeRoute = activeRoutes[0];
    if (activeRoute) {
      onClose();
      navigate(`/edit-plan?route=${activeRoute.id}&q=${encodeURIComponent(baseQuery + " w " + activeRoute.city)}`);
    } else {
      onClose();
      navigate(`/create?q=${encodeURIComponent(baseQuery)}`);
    }
  };

  const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === "assistant");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 p-2 text-muted-foreground hover:text-foreground z-10"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        aria-label={t("buttons.close")}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Center area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto min-h-0">

        {/* Orb with ripple rings */}
        <div className="relative flex items-center justify-center mb-8 flex-shrink-0">
          {isOrbActive && (
            <>
              <div className="absolute h-32 w-32 rounded-full border-2 border-orange-400/25 orb-ripple" />
              <div className="absolute h-32 w-32 rounded-full border-2 border-orange-400/15 orb-ripple-delay" />
            </>
          )}
          <div className={cn("h-32 w-32 rounded-full orb-gradient orb-emerge", isOrbActive && "orb-speaking")} />
        </div>

        {/* Content fades in after orb lands */}
        <div
          className={cn(
            "w-full max-w-sm transition-all duration-500 flex flex-col gap-4 items-center",
            showInput ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Chat mode: show last user message + AI response */}
          {inChatMode ? (
            <div className="w-full space-y-3">
              {/* Last user message */}
              {chatMessages.filter(m => m.role === "user").slice(-1).map((m, i) => (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] bg-foreground text-background rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                    {m.content}
                  </div>
                </div>
              ))}

              {/* AI loading */}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {/* AI response */}
              {lastAssistantMsg && !chatLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
                    {lastAssistantMsg.content}
                  </div>
                </div>
              )}

              {/* Place cards */}
              {chatPlaces.length > 0 && !chatLoading && (
                <div className="space-y-2 w-full">
                  {chatPlaces.map((place, i) => {
                    const added = addedPlaces.has(place.name);
                    return (
                      <div key={i} className="rounded-2xl bg-card border border-border/50 p-4 flex items-start gap-3">
                        <div className="text-xl flex-shrink-0 mt-0.5">
                          {CATEGORY_EMOJI[place.category] ?? "📍"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm leading-tight">{place.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{place.address}</p>
                          {place.description && (
                            <p className="text-xs text-muted-foreground/80 mt-1 leading-snug">{place.description}</p>
                          )}
                        </div>
                        {activeRoutes.length > 0 && (
                          <button
                            onClick={() => handleAddPlace(place)}
                            disabled={added}
                            className={cn(
                              "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                              added
                                ? "bg-green-500/20 text-green-600"
                                : "bg-foreground/5 hover:bg-foreground/10 text-foreground"
                            )}
                          >
                            {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reset chat */}
              {!chatLoading && (
                <button
                  onClick={() => { setChatMessages([]); setChatPlaces([]); setAddedPlaces(new Set()); }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors self-center"
                >
                  ← Wróć
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Initial state: question + chips */}
              <p className="text-2xl font-bold tracking-tight text-center">
                {tHome("orb_question")}
              </p>

              {showSightseeingCategories ? (
                <div className="flex flex-col gap-2 w-full items-center">
                  <p className="text-xs text-muted-foreground text-center">
                    {i18n.language === "en" ? "What are you looking for?" : "Co Cię interesuje?"}
                  </p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {sightseeingCategories.map((cat) => (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => handleSightseeingCategory(cat.query)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:bg-muted active:scale-95 transition-transform"
                      >
                        {cat.emoji} {cat.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowSightseeingCategories(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
                    >
                      ← {i18n.language === "en" ? "Back" : "Wróć"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap justify-center">
                  {visibleChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        if (chip.action) chip.action();
                        else handleSubmit(chip.query);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:bg-muted active:scale-95 transition-transform"
                    >
                      {chip.icon}
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Place identification result */}
              {isIdentifying && (
                <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3 w-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{tHome("identifying_place")}</span>
                </div>
              )}
              {placeResult && !isIdentifying && (
                <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1 w-full">
                  {placeResult.found === false ? (
                    <p className="text-sm text-muted-foreground text-center">
                      {i18n.language === "en"
                        ? "No place detected. Try a photo of a building, monument, or landmark."
                        : "Nie wykryto miejsca. Spróbuj zdjęcia budynku, zabytku lub atrakcji."}
                    </p>
                  ) : (
                    <>
                      <p className="font-semibold text-sm">{placeResult.name}</p>
                      <p className="text-xs text-muted-foreground">{placeResult.description}</p>
                      {placeResult.tip && (
                        <p className="text-xs text-muted-foreground mt-1">💡 {placeResult.tip}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="flex-shrink-0 px-4 pb-safe pt-3 border-t border-border/20">
        <div className="flex gap-2 items-center max-w-sm mx-auto">
          <button
            type="button"
            onClick={handleToggleVoice}
            className={cn(
              "h-11 w-11 rounded-full border border-border flex items-center justify-center shrink-0 active:scale-90 transition-transform",
              isListening ? "bg-destructive text-destructive-foreground border-destructive animate-pulse" : "bg-card text-muted-foreground hover:text-foreground"
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
            placeholder={inChatMode ? "Dopytaj..." : tHome("orb_placeholder")}
            disabled={chatLoading}
            className="flex-1 bg-card border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />

          {!inChatMode && (
            <button
              type="button"
              onClick={handlePhoto}
              disabled={isIdentifying}
              className="h-11 w-11 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-40"
              aria-label={tHome("identify_place")}
            >
              <Camera className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!message.trim() || chatLoading}
            className="h-11 w-11 rounded-full orb-gradient disabled:opacity-30 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

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
