import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ArrowLeft, Plus, X, Camera, Coffee, UtensilsCrossed, ShoppingBag, Gift, Mountain, Waves, Pencil, Sparkles, Trophy, MapPinPlus } from "lucide-react";
import StarRating from "@/components/route/StarRating";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import UserMentionInput from "@/components/route/UserMentionInput";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RouteMap from "@/components/RouteMap";
import InteractiveRouteMap from "@/components/InteractiveRouteMap";
import DraggablePinList from "@/components/route/DraggablePinList";
import MapPinSelector from "@/components/route/MapPinSelector";
import PinNotesSection from "@/components/route/PinNotesSection";
import { findOriginalPinCreator, checkPinDiscoveryInfo } from "@/lib/pinDiscovery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
}

interface Pin {
  id?: string;
  place_name: string;
  address: string;
  description: string;
  image_url: string;
  images: string[];
  rating: number;
  pin_order: number;
  tags: string[];
  latitude?: number;
  longitude?: number;
  notes: PinNote[];
  original_creator_id?: string;
  original_creator_username?: string;
}

const CreateRoute = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pins, setPins] = useState<Pin[]>([
    { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: 0, tags: [], latitude: undefined, longitude: undefined, notes: [] },
  ]);
  const [routeMentionedUsers, setRouteMentionedUsers] = useState<string[]>([]);
  // routeNotes state removed - notes are now stored per-pin
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tripType, setTripType] = useState<"planning" | "ongoing" | "completed">("completed");
  const [step, setStep] = useState(1);
  const [routeDescription, setRouteDescription] = useState("");
  const [routeRating, setRouteRating] = useState(0);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [showPinsList, setShowPinsList] = useState(false);
  const [showQuickMapSelector, setShowQuickMapSelector] = useState(false);
  
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const routeIdRef = useRef<string | null>(id || null);

  // Check if user has added any pins with data
  const hasAddedPins = pins.some(p => p.address && p.address.trim() !== "");

  const handleBackClick = () => {
    if (step === 3) {
      setStep(2);
      setShowPinsList(true);
    } else if (step === 2) {
      if (showPinsList) {
        // Going back from pins list - check if there are pins
        if (hasAddedPins) {
          setShowExitConfirm(true);
        } else {
          setStep(1);
        }
      } else {
        setShowPinsList(true);
      }
    } else {
      // Step 1 - navigate away
      navigate("/");
    }
  };

  const resetFormState = () => {
    setTitle("");
    setDescription("");
    setRouteDescription("");
    setPins([{ 
      place_name: "", address: "", description: "", image_url: "", 
      images: [], rating: 0, pin_order: 0, tags: [], 
      latitude: undefined, longitude: undefined,
      notes: []
    }]);
    setRouteMentionedUsers([]);
    setCurrentPinIndex(0);
    setStep(1);
    setTripType("completed");
    setShowPinsList(false);
    setShowCustomTagInput(false);
    setRouteRating(0);
    routeIdRef.current = null; // Reset so new draft is created
  };

  // Discard current draft and start fresh
  const discardDraft = async () => {
    if (routeIdRef.current && user) {
      // Delete the draft from database
      await supabase.from("routes").delete().eq("id", routeIdRef.current).eq("user_id", user.id);
    }
    resetFormState();
    toast({
      title: "Wersja robocza została usunięta",
      description: "Możesz rozpocząć nową trasę",
    });
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    resetFormState();
    navigate("/");
  };

  // Auto-save function (silent, doesn't navigate)
  const autoSaveRoute = useCallback(async () => {
    if (!user || !title.trim() || !hasAddedPins || saving || autoSaving) return;
    
    const validPins = pins.filter(p => p.address).map(p => ({
      ...p,
      place_name: p.place_name || p.address
    }));
    
    if (validPins.length === 0) return;

    setAutoSaving(true);

    try {
      if (routeIdRef.current) {
        // Update existing route
        await supabase
          .from("routes")
          .update({ 
            title, 
            description: routeDescription || description, 
            status: "draft", 
            rating: routeRating, 
            trip_type: tripType || 'completed' 
          })
          .eq("id", routeIdRef.current);

        // Delete existing pins
        await supabase.from("pins").delete().eq("route_id", routeIdRef.current);

        // Insert updated pins
        for (const pin of validPins) {
          const originalCreatorId = await findOriginalPinCreator(pin.latitude, pin.longitude);
          
          const { data: insertedPin } = await supabase.from("pins").insert({
            route_id: routeIdRef.current,
            place_name: pin.place_name,
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: false,
            latitude: pin.latitude,
            longitude: pin.longitude,
            original_creator_id: originalCreatorId || user.id,
          }).select().single();

          // Save notes
          if (pin.notes && pin.notes.length > 0 && insertedPin) {
            for (const note of pin.notes) {
              await supabase.from("route_notes").insert({
                route_id: routeIdRef.current,
                pin_id: insertedPin.id,
                text: note.text,
                image_url: note.imageUrl,
                note_order: note.note_order,
              });
            }
          }
        }
      } else {
        // Create new route
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ 
            user_id: user.id, 
            title, 
            description: routeDescription || description, 
            status: "draft", 
            rating: routeRating, 
            trip_type: tripType || 'completed' 
          })
          .select()
          .single();

        if (routeError) throw routeError;
        routeIdRef.current = route.id;

        for (const pin of validPins) {
          const originalCreatorId = await findOriginalPinCreator(pin.latitude, pin.longitude);
          
          const { data: insertedPin } = await supabase.from("pins").insert({
            route_id: route.id,
            place_name: pin.place_name,
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: false,
            latitude: pin.latitude,
            longitude: pin.longitude,
            original_creator_id: originalCreatorId || user.id,
          }).select().single();

          if (pin.notes && pin.notes.length > 0 && insertedPin) {
            for (const note of pin.notes) {
              await supabase.from("route_notes").insert({
                route_id: route.id,
                pin_id: insertedPin.id,
                text: note.text,
                image_url: note.imageUrl,
                note_order: note.note_order,
              });
            }
          }
        }
      }

      setLastAutoSave(new Date());
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setAutoSaving(false);
    }
  }, [user, title, description, routeDescription, pins, routeRating, tripType, hasAddedPins, saving, autoSaving]);

  // Auto-save interval (every 30 seconds)
  useEffect(() => {
    if (step >= 2 && hasAddedPins && title.trim()) {
      autoSaveIntervalRef.current = setInterval(() => {
        autoSaveRoute();
      }, 30000);
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [step, hasAddedPins, title, autoSaveRoute]);

  // Beforeunload event - warn user and save draft
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAddedPins && step >= 2) {
        // Try to save draft before leaving
        autoSaveRoute();
        e.preventDefault();
        e.returnValue = "Masz niezapisane zmiany. Czy na pewno chcesz opuścić stronę?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAddedPins, step, autoSaveRoute]);

  // Save draft when user switches tabs or minimizes browser
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasAddedPins && step >= 2 && title.trim()) {
        autoSaveRoute();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasAddedPins, step, title, autoSaveRoute]);

  // Update routeIdRef when editing existing route
  useEffect(() => {
    if (id) {
      routeIdRef.current = id;
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch existing route when editing
  const { data: existingRoute } = useQuery({
    queryKey: ["route", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("routes")
        .select("*, pins (*)")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch pin notes for each pin
      const pinIds = data.pins?.map((p: any) => p.id) || [];
      let pinNotes: any[] = [];
      if (pinIds.length > 0) {
        const { data: notes } = await supabase
          .from("route_notes")
          .select("*")
          .in("pin_id", pinIds);
        pinNotes = notes || [];
      }

      return { ...data, pin_notes: pinNotes };
    },
    enabled: !!id && !!user,
  });

  // Load user's draft when entering /create (not editing)
  const { data: userDraft } = useQuery({
    queryKey: ["user-draft", user?.id],
    queryFn: async () => {
      if (!user || id) return null; // Don't load if editing existing route
      
      const { data, error } = await supabase
        .from("routes")
        .select("*, pins (*)")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      if (!data.pins || data.pins.length === 0) return null;

      // Fetch pin notes
      const pinIds = data.pins.map((p: any) => p.id);
      let pinNotes: any[] = [];
      if (pinIds.length > 0) {
        const { data: notes } = await supabase
          .from("route_notes")
          .select("*")
          .in("pin_id", pinIds);
        pinNotes = notes || [];
      }

      return { ...data, pin_notes: pinNotes };
    },
    enabled: !!user && !id,
  });

  // Auto-load draft when available (no dialog)
  useEffect(() => {
    if (userDraft && !id) {
      routeIdRef.current = userDraft.id;
      setTitle(userDraft.title);
      setDescription(userDraft.description || "");
      setRouteDescription(userDraft.description || "");
      setTripType(userDraft.trip_type || "completed");
      setRouteRating(userDraft.rating || 0);
      
      if (userDraft.pins?.length > 0) {
        const pinNotes = userDraft.pin_notes || [];
        setPins(
          userDraft.pins
            .sort((a: any, b: any) => a.pin_order - b.pin_order)
            .map((pin: any) => ({
              ...pin,
              images: pin.images || [],
              rating: typeof pin.rating === 'number' ? pin.rating : 0,
              notes: pinNotes
                .filter((n: any) => n.pin_id === pin.id)
                .sort((a: any, b: any) => a.note_order - b.note_order)
                .map((n: any) => ({
                  id: n.id,
                  text: n.text || "",
                  imageUrl: n.image_url,
                  note_order: n.note_order,
                })),
            }))
        );
        setShowPinsList(true);
        setStep(2);
      }
    }
  }, [userDraft, id]);

  useEffect(() => {
    if (existingRoute) {
      setTitle(existingRoute.title);
      setDescription(existingRoute.description || "");
      setRouteDescription(existingRoute.description || "");
      if (existingRoute.pins?.length > 0) {
        const pinNotes = existingRoute.pin_notes || [];
        setPins(
          existingRoute.pins
            .sort((a: any, b: any) => a.pin_order - b.pin_order)
            .map((pin: any) => ({
              ...pin,
              images: pin.images || [],
              rating: typeof pin.rating === 'number' ? pin.rating : 0,
              notes: pinNotes
                .filter((n: any) => n.pin_id === pin.id)
                .sort((a: any, b: any) => a.note_order - b.note_order)
                .map((n: any) => ({
                  id: n.id,
                  text: n.text || "",
                  imageUrl: n.image_url,
                  note_order: n.note_order,
                })),
            }))
        );
        setShowPinsList(true);
      }
      setStep(2);
    }
  }, [existingRoute]);

  useEffect(() => {
    const validPins = pins.filter(p => p.rating > 0);
    if (validPins.length > 0) {
      const avgRating = validPins.reduce((sum, pin) => sum + pin.rating, 0) / validPins.length;
      setRouteRating(Math.round(avgRating * 10) / 10);
    } else {
      setRouteRating(0);
    }
  }, [pins]);

  const addPin = () => {
    setPins(prevPins => {
      const newPin: Pin = { 
        place_name: "", 
        address: "", 
        description: "", 
        image_url: "", 
        images: [], 
        rating: 0, 
        pin_order: prevPins.length, 
        tags: [], 
        latitude: undefined, 
        longitude: undefined,
        notes: []
      };
      const newPins = [...prevPins, newPin];
      setCurrentPinIndex(newPins.length - 1);
      return newPins;
    });
  };

  const removePin = (index: number) => {
    const newPins = pins.filter((_, i) => i !== index).map((pin, i) => ({ ...pin, pin_order: i }));
    setPins(newPins);
    if (currentPinIndex >= newPins.length) {
      setCurrentPinIndex(Math.max(0, newPins.length - 1));
    }
  };

  // Helper to upload note image to storage
  const uploadNoteImage = async (imageUrl: string): Promise<string | null> => {
    if (!imageUrl.startsWith("data:") || !user) return imageUrl;
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileExt = "jpg";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, blob);

      if (uploadError) return null;

      const { data: { publicUrl } } = supabase.storage
        .from("route-images")
        .getPublicUrl(fileName);
      return publicUrl;
    } catch {
      return null;
    }
  };

  const updatePin = (index: number, field: keyof Pin, value: any) => {
    const newPins = [...pins];
    newPins[index] = { ...newPins[index], [field]: value };
    setPins(newPins);
  };

  const handleImageUpload = async (files: FileList, pinIndex: number) => {
    if (!user) return;

    const file = files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("route-images")
      .upload(fileName, file);

    if (uploadError) {
      toast({ variant: "destructive", title: "Błąd podczas przesyłania zdjęcia" });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("route-images")
      .getPublicUrl(fileName);

    setPins(prevPins => {
      const newPins = [...prevPins];
      newPins[pinIndex] = {
        ...newPins[pinIndex],
        image_url: publicUrl,
        images: [publicUrl]
      };
      return newPins;
    });
  };

  // Handler for quick pin add from map
  const handleQuickPinAdd = async (pinData: { latitude: number; longitude: number; place_name: string; address: string }) => {
    const discoveryInfo = await checkPinDiscoveryInfo(pinData.latitude, pinData.longitude);
    
    const newPin: Pin = {
      place_name: pinData.place_name || pinData.address,
      address: pinData.address || pinData.place_name,
      description: "",
      image_url: "",
      images: [],
      rating: 0,
      pin_order: pins.filter(p => p.address).length,
      tags: [],
      latitude: pinData.latitude,
      longitude: pinData.longitude,
      notes: [],
      original_creator_id: discoveryInfo?.originalCreatorId || undefined,
      original_creator_username: discoveryInfo?.originalCreatorUsername || undefined,
    };
    
    // Add to pins list
    setPins(prevPins => {
      // If there's an empty pin at the end, replace it
      const lastPin = prevPins[prevPins.length - 1];
      if (!lastPin.address) {
        const newPins = [...prevPins];
        newPins[newPins.length - 1] = newPin;
        return newPins;
      }
      return [...prevPins, newPin];
    });
    
    setShowQuickMapSelector(false);
    setShowPinsList(true);
    
    toast({
      title: "Pin dodany",
      description: `Dodano: ${pinData.place_name || pinData.address}`,
    });
  };

  const saveRoute = async (status: "draft" | "published") => {
    if (!user || !title.trim()) {
      toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
      return;
    }

    const validPins = pins.filter(p => p.address).map(p => ({
      ...p,
      place_name: p.place_name || p.address
    }));
    
    if (validPins.length === 0) {
      toast({ variant: "destructive", title: "Dodaj przynajmniej jedną pinezkę" });
      return;
    }

    // Rating validation only for non-planning trip types
    if (status === "published" && tripType !== "planning") {
      const pinsWithoutRating = validPins.filter(p => p.rating <= 0);
      if (pinsWithoutRating.length > 0) {
        toast({ 
          variant: "destructive", 
          title: "Wszystkie pinezki muszą mieć ocenę", 
          description: "Dodaj ocenę do wszystkich pinezek przed publikacją"
        });
        return;
      }
    }

    setSaving(true);

    try {
      let routeId = id;

      if (id) {
        const { error: routeError } = await supabase
          .from("routes")
          .update({ title, description: routeDescription || description, status, rating: routeRating, trip_type: tripType || 'completed' })
          .eq("id", id);

        if (routeError) throw routeError;

        // Delete existing pins (cascades to route_notes via FK)
        await supabase.from("pins").delete().eq("route_id", id);

        for (const pin of validPins) {
          // Find original creator for this location
          const originalCreatorId = await findOriginalPinCreator(pin.latitude, pin.longitude);
          
          const { data: insertedPin, error: pinError } = await supabase.from("pins").insert({
            route_id: id,
            place_name: pin.place_name,
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: false,
            transport_type: "",
            transport_end: "",
            mentioned_users: routeMentionedUsers,
            latitude: pin.latitude,
            longitude: pin.longitude,
            original_creator_id: originalCreatorId || user.id,
          }).select().single();
          if (pinError) throw pinError;

          // Trigger async translation (fire-and-forget)
          if (insertedPin && pin.place_name) {
            supabase.functions.invoke('translate-place', {
              body: { 
                pin_id: insertedPin.id, 
                place_name: pin.place_name,
                address: pin.address 
              }
            }).catch(err => console.log('Translation request failed:', err));
          }

          // Save notes for this pin
          if (pin.notes && pin.notes.length > 0 && insertedPin) {
            for (const note of pin.notes) {
              // Upload image if it's base64
              let imageUrl = note.imageUrl;
              if (imageUrl && imageUrl.startsWith("data:")) {
                const uploaded = await uploadNoteImage(imageUrl);
                imageUrl = uploaded || undefined;
              }
              await supabase.from("route_notes").insert({
                route_id: id,
                pin_id: insertedPin.id,
                text: note.text,
                image_url: imageUrl,
                note_order: note.note_order,
              });
            }
          }
        }
      } else {
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ user_id: user.id, title, description: routeDescription || description, status, rating: routeRating, trip_type: tripType || 'completed' })
          .select()
          .single();

        if (routeError) throw routeError;
        routeId = route.id;

        for (const pin of validPins) {
          // Find original creator for this location
          const originalCreatorId = await findOriginalPinCreator(pin.latitude, pin.longitude);
          
          const { data: insertedPin, error: pinError } = await supabase.from("pins").insert({
            route_id: route.id,
            place_name: pin.place_name,
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: false,
            transport_type: "",
            transport_end: "",
            mentioned_users: routeMentionedUsers,
            latitude: pin.latitude,
            longitude: pin.longitude,
            original_creator_id: originalCreatorId || user.id,
          }).select().single();
          if (pinError) throw pinError;

          // Trigger async translation (fire-and-forget)
          if (insertedPin && pin.place_name) {
            supabase.functions.invoke('translate-place', {
              body: { 
                pin_id: insertedPin.id, 
                place_name: pin.place_name,
                address: pin.address 
              }
            }).catch(err => console.log('Translation request failed:', err));
          }

          // Save notes for this pin
          if (pin.notes && pin.notes.length > 0 && insertedPin) {
            for (const note of pin.notes) {
              // Upload image if it's base64
              let imageUrl = note.imageUrl;
              if (imageUrl && imageUrl.startsWith("data:")) {
                const uploaded = await uploadNoteImage(imageUrl);
                imageUrl = uploaded || undefined;
              }
              await supabase.from("route_notes").insert({
                route_id: route.id,
                pin_id: insertedPin.id,
                text: note.text,
                image_url: imageUrl,
                note_order: note.note_order,
              });
            }
          }
        }
      }

      const isUpdating = !!id;
      const wasPublished = existingRoute?.status === "published";
      
      let toastMessage = "";
      if (isUpdating && wasPublished && status === "published") {
        toastMessage = "Trasa zaktualizowana!";
      } else if (status === "published") {
        toastMessage = "Trasa opublikowana!";
      } else {
        toastMessage = "Trasa zapisana jako wersja robocza";
      }
      
      toast({ title: toastMessage });
      navigate("/my-routes");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Błąd", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-4 z-10">
        <button onClick={handleBackClick}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex-1">
          {step === 1 ? "Utwórz nową trasę" : step === 2 ? (showPinsList ? "Lista pinezek" : title || "Edytuj pinezkę") : "Podsumowanie trasy"}
        </h1>
        {step >= 2 && hasAddedPins && (
          <div className="text-xs text-muted-foreground text-right">
            {autoSaving ? (
              <span className="animate-pulse">Zapisywanie...</span>
            ) : lastAutoSave ? (
              <span>Zapisano {lastAutoSave.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : null}
            {routeIdRef.current && !id && (
              <button
                onClick={discardDraft}
                className="block text-destructive hover:underline mt-0.5"
              >
                Porzuć roboczą
              </button>
            )}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Nazwa trasy * (max 10 słów)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  const words = e.target.value.trim().split(/\s+/).filter(w => w.length > 0);
                  if (words.length <= 10 || e.target.value.length < title.length) {
                    setTitle(e.target.value);
                  }
                }}
                placeholder="np. Ukryte skarby Tokio"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.trim() ? title.trim().split(/\s+/).filter(w => w.length > 0).length : 0}/10 słów
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Co dalej?</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Dodaj nieograniczoną liczbę pinezek do trasy</li>
                <li>Każda pinezka wymaga nazwy, adresu i oceny</li>
                <li>Opcjonalnie dodaj zdjęcia, opisy i wzmianki</li>
                <li>Przeglądaj i publikuj, gdy będzie gotowa</li>
              </ul>
            </div>

            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={() => {
                if (!title.trim()) {
                  toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
                  return;
                }
                setShowQuickMapSelector(true);
              }}
            >
              <MapPinPlus className="h-4 w-4 mr-2" />
              Szybkie dodanie
            </Button>
          </div>
        ) : step === 2 ? (
          <>
            {showPinsList && pins.filter(p => p.address).length > 0 ? (
              <div className="space-y-4 pb-24">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Pinezki w trasie</h2>
                </div>

                <div className="space-y-3">
                  <DraggablePinList
                    pins={pins}
                    onReorder={setPins}
                    onPinClick={(index) => {
                      setCurrentPinIndex(index);
                      setShowPinsList(false);
                    }}
                    onPinRemove={removePin}
                    onPinNotesChange={(pinIndex, notes) => updatePin(pinIndex, "notes", notes)}
                    showRemoveButton={true}
                    showNotesEditor={true}
                    compact={true}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      addPin();
                      setShowPinsList(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj pinezkę
                  </Button>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setStep(3)}
                    disabled={pins.filter(p => p.address).length === 0}
                  >
                    Przejdź do podsumowania
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      Pinezka {currentPinIndex + 1}/{pins.length}
                    </h2>
                    <div className="flex gap-2">
                      {currentPinIndex > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPinIndex(currentPinIndex - 1)}
                        >
                          ←
                        </Button>
                      )}
                      {currentPinIndex < pins.length - 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPinIndex(currentPinIndex + 1)}
                        >
                          →
                        </Button>
                      )}
                      {pins.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removePin(currentPinIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="default" size="icon" onClick={addPin}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Map preview - shows existing pins */}
                  {pins.some(p => p.latitude && p.longitude) && (
                    <div className="space-y-2">
                      <Label>Podgląd mapy</Label>
                      <RouteMap 
                        pins={pins.filter(p => p.latitude && p.longitude)}
                        className="h-32 rounded-lg"
                      />
                    </div>
                  )}

                  {/* Address - moved to top */}
                  <div>
                    <Label>Adres *</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={pins[currentPinIndex]?.address || ""}
                          onChange={async (value, coordinates, fullAddress, placeName) => {
                            // Check for original creator
                            let discoveryInfo: { originalCreatorId: string | null; originalCreatorUsername: string | null } | null = null;
                            if (coordinates?.latitude && coordinates?.longitude) {
                              discoveryInfo = await checkPinDiscoveryInfo(coordinates.latitude, coordinates.longitude);
                            }
                            
                            setPins(prevPins => {
                              const newPins = [...prevPins];
                              if (newPins[currentPinIndex]) {
                                newPins[currentPinIndex] = {
                                  ...newPins[currentPinIndex],
                                  address: fullAddress || value,
                                  place_name: placeName || fullAddress || value,
                                  latitude: coordinates?.latitude,
                                  longitude: coordinates?.longitude,
                                  original_creator_id: discoveryInfo?.originalCreatorId || undefined,
                                  original_creator_username: discoveryInfo?.originalCreatorUsername || undefined,
                                };
                              }
                              return newPins;
                            });
                          }}
                          placeholder="Wpisz adres miejsca"
                        />
                      </div>
                      <MapPinSelector
                        existingPins={pins.filter(p => p.latitude && p.longitude)}
                        onPinSelect={async (pinData) => {
                          // Check for original creator
                          const discoveryInfo = await checkPinDiscoveryInfo(pinData.latitude, pinData.longitude);
                          
                          setPins(prevPins => {
                            const newPins = [...prevPins];
                            newPins[currentPinIndex] = {
                              ...newPins[currentPinIndex],
                              address: pinData.address,
                              place_name: pinData.place_name || pinData.address,
                              latitude: pinData.latitude,
                              longitude: pinData.longitude,
                              original_creator_id: discoveryInfo?.originalCreatorId || undefined,
                              original_creator_username: discoveryInfo?.originalCreatorUsername || undefined,
                            };
                            return newPins;
                          });
                          toast({ title: "Lokalizacja wybrana", description: pinData.place_name || pinData.address });
                        }}
                      />
                    </div>
                    
                    {/* Discovery info */}
                    {pins[currentPinIndex]?.original_creator_id === user?.id && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2 mt-2">
                        <Trophy className="h-4 w-4" />
                        <span className="font-medium">Twoje odkrycie! Jesteś pierwszym odkrywcą tego miejsca</span>
                      </div>
                    )}
                    {pins[currentPinIndex]?.original_creator_username && 
                     pins[currentPinIndex]?.original_creator_id !== user?.id && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-2 mt-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        <span>
                          Odkryte przez{" "}
                          <Link 
                            to={`/profile/${pins[currentPinIndex]?.original_creator_id}`} 
                            className="font-medium text-primary hover:underline"
                          >
                            @{pins[currentPinIndex]?.original_creator_username}
                          </Link>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Place name - editable */}
                  <div>
                    <Label>Nazwa miejsca</Label>
                    <Input
                      value={pins[currentPinIndex]?.place_name || ""}
                      onChange={(e) => updatePin(currentPinIndex, "place_name", e.target.value)}
                      placeholder="Nazwa miejsca (np. Pałac Kultury)"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Możesz zmienić nazwę na bardziej przyjazną
                    </p>
                  </div>


                  <div>
                    <Label>Opis (Opcjonalne)</Label>
                    <Textarea
                      value={pins[currentPinIndex]?.description || ""}
                      onChange={(e) => {
                        const words = e.target.value.trim().split(/\s+/).filter(w => w.length > 0);
                        if (words.length <= 150 || e.target.value.length < (pins[currentPinIndex]?.description || "").length) {
                          updatePin(currentPinIndex, "description", e.target.value);
                        }
                      }}
                      placeholder="Wpisz notatki o tym miejscu..."
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(pins[currentPinIndex]?.description || "").trim() ? (pins[currentPinIndex]?.description || "").trim().split(/\s+/).filter(w => w.length > 0).length : 0}/150 słów
                    </p>
                  </div>


                  {/* Rating - centered - hidden for planning mode */}
                  {tripType !== "planning" && (
                    <div>
                      <Label>Ocena *</Label>
                      <div className="mt-2 flex justify-center">
                        <StarRating
                          rating={pins[currentPinIndex]?.rating || 0}
                          onRatingChange={(rating) => updatePin(currentPinIndex, "rating", rating)}
                          size="lg"
                          interactive={true}
                        />
                      </div>
                    </div>
                  )}

                  {/* Image upload - hidden for planning mode */}
                  {tripType !== "planning" && (
                    <div>
                      <Label>Zdjęcie (Opcjonalne)</Label>
                      <div className="mt-2">
                        {pins[currentPinIndex]?.image_url ? (
                          <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                            <img
                              src={pins[currentPinIndex]?.image_url}
                              alt="Podgląd zdjęcia"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updatePin(currentPinIndex, "image_url", "");
                                updatePin(currentPinIndex, "images", []);
                              }}
                              className="absolute top-2 right-2 bg-background/80 hover:bg-background p-2 rounded-full transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                            <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Dotknij, aby dodać zdjęcie
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleImageUpload(e.target.files, currentPinIndex);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Tag selection - all visible */}
                  <div className="pb-32">
                    <Label>Kategoria (Opcjonalne)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        { name: "Restauracja", icon: UtensilsCrossed },
                        { name: "Kawiarnia", icon: Coffee },
                        { name: "Jedzenie", icon: UtensilsCrossed },
                        { name: "Zakupy", icon: ShoppingBag },
                        { name: "Pamiątki", icon: Gift },
                        { name: "Herbata", icon: Coffee },
                        { name: "Góry", icon: Mountain },
                        { name: "Morze", icon: Waves }
                      ].map(({ name, icon: Icon }) => {
                        const isSelected = pins[currentPinIndex]?.tags?.includes(name);
                        return (
                          <Badge
                            key={name}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm"
                            onClick={() => {
                              const currentTags = pins[currentPinIndex]?.tags || [];
                              const newTags = isSelected 
                                ? currentTags.filter(t => t !== name)
                                : [...currentTags, name];
                              updatePin(currentPinIndex, "tags", newTags);
                            }}
                          >
                            <Icon className="h-4 w-4" />
                            {name}
                            {isSelected && <X className="h-3.5 w-3.5 ml-1" />}
                          </Badge>
                        );
                      })}
                      {/* "Inne" tag - opens custom input inline */}
                      {showCustomTagInput ? (
                        <Input
                          autoFocus
                          placeholder="Wpisz i naciśnij Enter"
                          className="h-9 w-40"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              const newTag = e.currentTarget.value.trim();
                              const currentTags = pins[currentPinIndex]?.tags || [];
                              if (!currentTags.some(t => t.toLowerCase() === newTag.toLowerCase())) {
                                updatePin(currentPinIndex, "tags", [...currentTags, newTag]);
                              }
                              e.currentTarget.value = '';
                            } else if (e.key === 'Escape') {
                              setShowCustomTagInput(false);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.currentTarget.value.trim()) {
                              const newTag = e.currentTarget.value.trim();
                              const currentTags = pins[currentPinIndex]?.tags || [];
                              if (!currentTags.some(t => t.toLowerCase() === newTag.toLowerCase())) {
                                updatePin(currentPinIndex, "tags", [...currentTags, newTag]);
                              }
                            }
                            setShowCustomTagInput(false);
                          }}
                        />
                      ) : (
                        <Badge
                          variant="outline"
                          className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm"
                          onClick={() => setShowCustomTagInput(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Inne
                        </Badge>
                      )}
                    </div>
                    
                    {/* Custom tags display */}
                    {pins[currentPinIndex]?.tags?.filter(
                      tag => !["Restauracja", "Kawiarnia", "Jedzenie", "Zakupy", "Pamiątki", "Herbata", "Góry", "Morze"].includes(tag)
                    ).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pins[currentPinIndex]?.tags?.filter(
                          tag => !["Restauracja", "Kawiarnia", "Jedzenie", "Zakupy", "Pamiątki", "Herbata", "Góry", "Morze"].includes(tag)
                        ).map(tag => (
                          <Badge
                            key={tag}
                            variant="default"
                            className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm"
                            onClick={() => {
                              const currentTags = pins[currentPinIndex]?.tags || [];
                              updatePin(currentPinIndex, "tags", currentTags.filter(t => t !== tag));
                            }}
                          >
                            {tag} <X className="h-3.5 w-3.5 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      const currentPin = pins[currentPinIndex];
                      if (!currentPin?.address) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Adres jest wymagany przed powrotem do listy"
                        });
                        return;
                      }
                      if (tripType !== "planning" && currentPin.rating <= 0) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Ocena jest wymagana przed powrotem do listy"
                        });
                        return;
                      }
                      setShowPinsList(true);
                    }}
                  >
                    Przejdź do listy pinezek
                  </Button>
                </div>
              </>
            )}
          </>
        ) : step === 3 ? (
          <>
            <div className="space-y-4 pb-80">
              {/* Header with editable title */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="summary-title" className="text-sm text-muted-foreground">Nazwa trasy</Label>
                  <Input
                    id="summary-title"
                    value={title}
                    onChange={(e) => {
                      const words = e.target.value.trim().split(/\s+/).filter(w => w.length > 0);
                      if (words.length <= 10 || e.target.value.length < title.length) {
                        setTitle(e.target.value);
                      }
                    }}
                    placeholder="Nazwa trasy"
                    className="text-lg font-semibold"
                  />
                  <p className="text-xs text-muted-foreground">
                    {title.trim() ? title.trim().split(/\s+/).filter(w => w.length > 0).length : 0}/10 słów
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{pins.filter(p => p.address).length} {pins.filter(p => p.address).length === 1 ? 'punkt' : 'punktów'}</span>
                  {routeRating > 0 && (
                    <div className="flex items-center gap-1 text-foreground">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium">{routeRating.toFixed(1)}</span>
                      <span className="text-muted-foreground text-xs">Ogólna ocena</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Route map */}
              <RouteMap 
                pins={pins.filter(p => p.address).map(p => ({ ...p, place_name: p.place_name || p.address }))}
                className="h-40"
              />

              {/* Pins list */}
              <div className="space-y-3">
                <DraggablePinList
                  pins={pins}
                  onReorder={setPins}
                  onPinNotesChange={(pinIndex, notes) => updatePin(pinIndex, "notes", notes)}
                  onPinNameChange={(pinIndex, name) => updatePin(pinIndex, "place_name", name)}
                  showRemoveButton={false}
                  showNotesEditor={true}
                  showNameEditor={true}
                  compact={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    addPin();
                    setStep(2);
                    setShowPinsList(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj pinezkę
                </Button>
              </div>

              {/* Route description */}
              <div className="space-y-2">
                <Label htmlFor="route-description" className="text-sm">Opis trasy (Opcjonalne)</Label>
                <Textarea
                  id="route-description"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Podziel się ogólnymi wrażeniami i najważniejszymi szczegółami..."
                  rows={3}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Opowiedz obserwującym, co sprawiło, że ta trasa była wyjątkowa
                </p>
              </div>

              {/* Friend mentions for route */}
              <div className="space-y-2">
                <Label className="text-sm">Oznacz znajomych (Opcjonalne)</Label>
                <UserMentionInput
                  selectedUserIds={routeMentionedUsers}
                  onUserSelect={(userId) => {
                    setRouteMentionedUsers(prev => [...prev, userId]);
                  }}
                  onUserRemove={(userId) => {
                    setRouteMentionedUsers(prev => prev.filter(id => id !== userId));
                  }}
                />
              </div>

              {/* Overall route rating */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ogólna ocena trasy</Label>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    {routeRating.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ocena jest obliczana automatycznie na podstawie średniej z {pins.filter(p => p.rating > 0).length} {pins.filter(p => p.rating > 0).length === 1 ? 'ocenionej pinezki' : 'ocenionych pinezek'}
                </p>
                {pins.filter(p => p.rating > 0).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Uwzględnione oceny:</p>
                    <ul className="space-y-0.5 pl-4">
                      {pins.filter(p => p.rating > 0).map((pin, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-yellow-500">★</span>
                          <span>{pin.rating.toFixed(1)}</span>
                          <span>- {pin.place_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 max-w-lg mx-auto">
              <div className="flex gap-2">
                {existingRoute?.status === "published" ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 text-sm"
                      onClick={() => saveRoute("draft")}
                      disabled={saving}
                    >
                      Zapisz jako roboczą
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 text-sm"
                      onClick={() => saveRoute("published")}
                      disabled={saving}
                    >
                      Aktualizuj trasę
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 text-sm"
                      onClick={() => saveRoute("draft")}
                      disabled={saving}
                    >
                      Zapisz roboczą
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 text-sm"
                      onClick={() => saveRoute("published")}
                      disabled={saving}
                    >
                      Opublikuj trasę
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz wyjść?</AlertDialogTitle>
            <AlertDialogDescription>
              Masz niezapisane zmiany. Jeśli wyjdziesz, stracisz dodane pinezki.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={saving}>Zostań</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await saveRoute("draft");
                setShowExitConfirm(false);
              }}
              disabled={saving}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {saving ? "Zapisywanie..." : "Zapisz i wyjdź"}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowExitConfirm(false);
                confirmExit();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Wyjdź bez zapisywania
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Quick Map Selector Fullscreen Overlay */}
      {showQuickMapSelector && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-background border-b border-border p-4 flex items-center gap-3">
            <button 
              onClick={() => setShowQuickMapSelector(false)} 
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="font-semibold">Szybkie dodanie pina</h2>
          </div>
          <div className="flex-1">
            <InteractiveRouteMap
              pins={pins.filter(p => p.latitude && p.longitude)}
              className="h-full rounded-none border-0"
              onPinAdd={handleQuickPinAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateRoute;
