import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Minus, Camera, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";

// ─── Wheel Picker Component (iOS-style) ───

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}

const WheelPicker = ({ min, max, value, onChange, suffix = "" }: WheelPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Scroll to initial value on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const index = value - min;
    container.scrollTop = index * ITEM_HEIGHT;
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isScrollingRef.current) return;
    isScrollingRef.current = true;

    requestAnimationFrame(() => {
      const scrollTop = container.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      const newValue = items[clampedIndex];
      if (newValue !== value) {
        onChange(newValue);
      }
      isScrollingRef.current = false;
    });
  }, [value, onChange, items, min]);

  return (
    <div className="relative w-full max-w-[200px] mx-auto" style={{ height: PICKER_HEIGHT }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 border-y-2 border-primary/30 bg-primary/5 rounded-lg pointer-events-none z-10"
        style={{
          top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
          height: ITEM_HEIGHT,
        }}
      />
      {/* Fade overlays */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent pointer-events-none z-20" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />

      <div
        ref={containerRef}
        className="h-full overflow-y-scroll scrollbar-hide"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
      >
        {/* Top padding */}
        <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />

        {items.map((item) => {
          const isSelected = item === value;
          return (
            <div
              key={item}
              className={cn(
                "flex items-center justify-center transition-all duration-150",
                isSelected
                  ? "text-foreground font-bold text-3xl"
                  : "text-muted-foreground/60 text-xl"
              )}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
              }}
            >
              {item}{suffix ? ` ${suffix}` : ""}
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
      </div>
    </div>
  );
};

// ─── Day Card Component ───

interface DayCardProps {
  dayNumber: number;
  routes: { id: string; title: string; pinCount: number }[];
  onAddRoute: () => void;
  onRemoveDay: () => void;
  canRemove: boolean;
}

const DayCard = ({ dayNumber, routes, onAddRoute, onRemoveDay, canRemove }: DayCardProps) => (
  <div className="border-2 border-border rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-lg">#Dzień {dayNumber}</h3>
      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemoveDay}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>

    {routes.length > 0 && (
      <div className="space-y-2">
        {routes.map((route) => (
          <div
            key={route.id}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
          >
            <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="flex-1 truncate">{route.title}</span>
            <span className="text-xs text-muted-foreground">
              {route.pinCount} {route.pinCount === 1 ? "miejsce" : "miejsc"}
            </span>
          </div>
        ))}
      </div>
    )}

    <Button
      variant="outline"
      className="w-full border-dashed"
      onClick={onAddRoute}
    >
      <Plus className="h-4 w-4 mr-2" />
      Dodaj trasę
    </Button>
  </div>
);

// ─── Main CreateTrip Page ───

const CreateTrip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState(id ? 3 : 1);

  // Step 1: Days
  const [numDays, setNumDays] = useState(3);

  // Step 2: Details
  const [tripName, setTripName] = useState("");
  const [tripDescription, setTripDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Day cards
  const [tripId, setTripId] = useState<string | null>(id || null);
  const [dayRoutes, setDayRoutes] = useState<
    Record<number, { id: string; title: string; pinCount: number }[]>
  >({});
  const [saving, setSaving] = useState(false);

  // Load existing trip if editing
  useEffect(() => {
    if (id && user) {
      loadTrip(id);
    }
  }, [id, user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const loadTrip = async (tripId: string) => {
    const { data: trip } = await supabase
      .from("route_folders")
      .select("*")
      .eq("id", tripId)
      .single();

    if (trip) {
      setTripName(trip.name);
      setTripDescription(trip.description || "");
      setCoverImageUrl(trip.cover_image_url);
      setNumDays(trip.num_days || 1);
    }

    // Load routes for each day
    const { data: routes } = await supabase
      .from("routes")
      .select("id, title, day_number")
      .eq("folder_id", tripId)
      .order("day_number", { ascending: true });

    if (routes) {
      const grouped: Record<number, { id: string; title: string; pinCount: number }[]> = {};

      // Get pin counts
      for (const route of routes) {
        const dayNum = route.day_number || 1;
        if (!grouped[dayNum]) grouped[dayNum] = [];

        const { count } = await supabase
          .from("pins")
          .select("*", { count: "exact", head: true })
          .eq("route_id", route.id);

        grouped[dayNum].push({
          id: route.id,
          title: route.title,
          pinCount: count || 0,
        });
      }

      setDayRoutes(grouped);
    }
  };

  // Handle cover image upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 1920, 1080, 0.8);
      const fileName = `${user.id}/${Date.now()}-trip-cover.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, compressed, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("route-images").getPublicUrl(fileName);

      setCoverImageUrl(publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Błąd przesyłania",
        description: "Nie udało się przesłać zdjęcia",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save trip to database (step 2 → 3)
  const handleSaveTrip = async () => {
    if (!user || !tripName.trim()) return;
    setSaving(true);

    try {
      if (tripId) {
        // Update existing trip
        const { error } = await supabase
          .from("route_folders")
          .update({
            name: tripName.trim(),
            description: tripDescription.trim() || null,
            cover_image_url: coverImageUrl,
            num_days: numDays,
          })
          .eq("id", tripId);

        if (error) throw error;
      } else {
        // Create new trip
        const { data, error } = await supabase
          .from("route_folders")
          .insert({
            user_id: user.id,
            name: tripName.trim(),
            description: tripDescription.trim() || null,
            cover_image_url: coverImageUrl,
            is_trip: true,
            num_days: numDays,
          })
          .select()
          .single();

        if (error) throw error;
        setTripId(data.id);

        // Update URL without full navigation
        window.history.replaceState(null, "", `/create-trip/${data.id}`);
      }

      setStep(3);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Błąd zapisywania",
        description: "Nie udało się zapisać podróży",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Add a new day
  const handleAddDay = async () => {
    const newNumDays = numDays + 1;
    setNumDays(newNumDays);

    if (tripId) {
      await supabase
        .from("route_folders")
        .update({ num_days: newNumDays })
        .eq("id", tripId);
    }
  };

  // Remove a day
  const handleRemoveDay = async (dayNumber: number) => {
    if (numDays <= 1) return;

    // Check if day has routes
    if (dayRoutes[dayNumber]?.length > 0) {
      toast({
        title: "Nie można usunąć",
        description: "Najpierw usuń trasy z tego dnia",
        variant: "destructive",
      });
      return;
    }

    const newNumDays = numDays - 1;
    setNumDays(newNumDays);

    // Reindex days above removed one
    const newDayRoutes: Record<number, { id: string; title: string; pinCount: number }[]> = {};
    for (const [key, routes] of Object.entries(dayRoutes)) {
      const num = parseInt(key);
      if (num < dayNumber) {
        newDayRoutes[num] = routes;
      } else if (num > dayNumber) {
        newDayRoutes[num - 1] = routes;
        // Update in DB
        for (const route of routes) {
          await supabase
            .from("routes")
            .update({ day_number: num - 1 })
            .eq("id", route.id);
        }
      }
    }
    setDayRoutes(newDayRoutes);

    if (tripId) {
      await supabase
        .from("route_folders")
        .update({ num_days: newNumDays })
        .eq("id", tripId);
    }
  };

  // Navigate to create route for a specific day
  const handleAddRouteToDay = (dayNumber: number) => {
    if (!tripId) return;
    navigate(`/create?trip=${tripId}&day=${dayNumber}`);
  };

  const handleBack = () => {
    if (step > 1 && !id) {
      setStep(step - 1);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-center font-semibold">
            {step === 1 && "Nowa podróż"}
            {step === 2 && "Szczegóły podróży"}
            {step === 3 && (tripName || "Podróż")}
          </h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Step indicator */}
        {!id && (
          <div className="flex gap-1 px-4 pb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Step 1: Day Picker */}
      {step === 1 && (
        <div className="flex flex-col items-center justify-center px-6 pt-12">
          <h2 className="text-2xl font-bold text-center mb-2">
            Ile dni trwa podróż?
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Możesz zmienić to później
          </p>

          <WheelPicker
            min={1}
            max={30}
            value={numDays}
            onChange={setNumDays}
            suffix={numDays === 1 ? "dzień" : "dni"}
          />

          <Button
            onClick={() => setStep(2)}
            className="w-full max-w-sm h-12 text-base font-semibold mt-8"
          >
            Dalej
          </Button>
        </div>
      )}

      {/* Step 2: Trip Details */}
      {step === 2 && (
        <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
          {/* Cover image */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">OKŁADKA</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
            />
            {coverImageUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden border">
                <img
                  src={coverImageUrl}
                  alt="Okładka podróży"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => setCoverImageUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-8 w-8" />
                    <span className="text-sm">Dodaj zdjęcie okładki</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Trip name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">NAZWA PODRÓŻY</label>
            <Input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="np. Wakacje w Grecji"
              className="h-12 text-base"
              maxLength={60}
            />
          </div>

          {/* Trip description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              OPIS (opcjonalny)
            </label>
            <Textarea
              value={tripDescription}
              onChange={(e) => setTripDescription(e.target.value)}
              placeholder="Krótki opis podróży..."
              className="min-h-[100px] text-base resize-none"
              maxLength={500}
            />
          </div>

          <Button
            onClick={handleSaveTrip}
            disabled={!tripName.trim() || saving}
            className="w-full h-12 text-base font-semibold"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Dalej
          </Button>
        </div>
      )}

      {/* Step 3: Day Cards */}
      {step === 3 && (
        <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
          {/* Trip info summary */}
          {coverImageUrl && (
            <div className="aspect-video rounded-xl overflow-hidden border mb-4">
              <img
                src={coverImageUrl}
                alt={tripName}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-bold">{tripName}</h2>
            {tripDescription && (
              <p className="text-sm text-muted-foreground mt-1">{tripDescription}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {numDays} {numDays === 1 ? "dzień" : "dni"}
            </p>
          </div>

          {/* Day cards */}
          <div className="space-y-3">
            {Array.from({ length: numDays }, (_, i) => i + 1).map((dayNum) => (
              <DayCard
                key={dayNum}
                dayNumber={dayNum}
                routes={dayRoutes[dayNum] || []}
                onAddRoute={() => handleAddRouteToDay(dayNum)}
                onRemoveDay={() => handleRemoveDay(dayNum)}
                canRemove={numDays > 1 && !(dayRoutes[dayNum]?.length > 0)}
              />
            ))}
          </div>

          {/* Add day button */}
          {numDays < 30 && (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddDay}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj dzień
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CreateTrip;
