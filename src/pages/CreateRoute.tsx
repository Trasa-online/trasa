import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DebouncedTextarea from "@/components/route/DebouncedTextarea";

import { ArrowLeft, Plus, X, Camera, Coffee, UtensilsCrossed, ShoppingBag, Gift, Mountain, Waves, Pencil, Sparkles, Trophy, Check, MapPin } from "lucide-react";
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
import StepIndicator from "@/components/route/StepIndicator";
import { findOriginalPinCreator, checkPinDiscoveryInfo } from "@/lib/pinDiscovery";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompression";
import EmptyState from "@/components/ui/empty-state";
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
  canonical_pin_id?: string;
  visited_at?: string;
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
  
  // Undo deletion state
  const [deletedPinBuffer, setDeletedPinBuffer] = useState<Pin | null>(null);
  const [deletedPinIndex, setDeletedPinIndex] = useState<number | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const routeIdRef = useRef<string | null>(id || null);
  
  // Draft dialog states
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  const [draftDecisionMade, setDraftDecisionMade] = useState(false);
  
  // Lock to prevent concurrent saves
  const saveInProgressRef = useRef(false);
  
  // Flag to prevent auto-save during draft loading (CRITICAL: prevents race conditions)
  const draftLoadingRef = useRef(false);

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
    // Prevent concurrent saves and saves during draft loading
    if (!user || !title.trim() || saving || saveInProgressRef.current) return;
    
    // CRITICAL: Block auto-save while draft is being loaded to prevent race conditions
    if (draftLoadingRef.current) {
      console.log("Auto-save blocked: draft is loading");
      return;
    }
    
    // For drafts, keep pins that have COORDINATES or meaningful data
    // CRITICAL: Properly check for valid coordinates (including 0)
    const pinsToSave = pins.filter(p => {
      // A pin is valid if it has coordinates (including 0,0 which is valid!)
      const hasCoordinates = (
        typeof p.latitude === 'number' && 
        typeof p.longitude === 'number'
      );
      
      // OR if it has any other meaningful data
      const hasData = !!(
        p.address?.trim() || 
        p.place_name?.trim() || 
        p.description?.trim() || 
        p.images?.length > 0
      );
      
      return hasCoordinates || hasData;
    }).map((p, idx) => ({
      ...p,
      pin_order: idx, // Re-index to ensure correct order
      place_name: p.place_name || p.address || `Punkt ${idx + 1}`
    }));
    
    // CRITICAL: Only skip if we have ZERO pins after filtering
    if (pinsToSave.length === 0) {
      console.log("Auto-save skipped: no valid pins to save");
      return;
    }
    
    console.log(`Auto-save: Found ${pinsToSave.length} valid pins out of ${pins.length} total pins`);
    
    const validPins = pinsToSave;

    saveInProgressRef.current = true;
    setAutoSaving(true);

    try {
      // Prepare all pins data BEFORE any database operations
      const pinsToInsert = await Promise.all(validPins.map(async (pin) => {
        const originalCreatorId = await findOriginalPinCreator(pin.latitude, pin.longitude);
        return {
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
          notes: pin.notes, // Keep notes reference for later
        };
      }));

      if (routeIdRef.current) {
        // CRITICAL: Verify we have pins to insert BEFORE deleting existing ones
        if (pinsToInsert.length === 0) {
          console.warn("Auto-save aborted: pinsToInsert is empty, would cause data loss");
          saveInProgressRef.current = false;
          setAutoSaving(false);
          return;
        }

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

        // Delete existing pins and notes (in correct order to avoid FK issues)
        await supabase.from("route_notes").delete().eq("route_id", routeIdRef.current);
        await supabase.from("pins").delete().eq("route_id", routeIdRef.current);

        // BATCH INSERT - single request for all pins
        const { data: insertedPins, error: pinsError } = await supabase
          .from("pins")
          .insert(pinsToInsert.map(p => ({
            route_id: routeIdRef.current,
            place_name: p.place_name,
            address: p.address,
            description: p.description,
            image_url: p.image_url,
            images: p.images,
            rating: p.rating || null,
            pin_order: p.pin_order,
            tags: p.tags,
            is_transport: p.is_transport,
            latitude: p.latitude,
            longitude: p.longitude,
            original_creator_id: p.original_creator_id,
          })))
          .select();

        if (pinsError) throw pinsError;

        // Batch insert notes after pins are created - map by pin_order to ensure correct matching
        if (insertedPins) {
          const allNotesToInsert: any[] = [];
          
          // Create a map of pin_order -> inserted pin for reliable matching
          const insertedPinsByOrder = new Map(
            insertedPins.map(p => [p.pin_order, p])
          );
          
          for (const pinData of pinsToInsert) {
            const insertedPin = insertedPinsByOrder.get(pinData.pin_order);
            if (insertedPin && pinData.notes && pinData.notes.length > 0) {
              for (const note of pinData.notes) {
                allNotesToInsert.push({
                  route_id: routeIdRef.current,
                  pin_id: insertedPin.id,
                  text: note.text,
                  image_url: note.imageUrl,
                  note_order: note.note_order,
                });
              }
            }
          }
          if (allNotesToInsert.length > 0) {
            await supabase.from("route_notes").insert(allNotesToInsert);
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

        // BATCH INSERT - single request for all pins
        const { data: insertedPins, error: pinsError } = await supabase
          .from("pins")
          .insert(pinsToInsert.map(p => ({
            route_id: route.id,
            place_name: p.place_name,
            address: p.address,
            description: p.description,
            image_url: p.image_url,
            images: p.images,
            rating: p.rating || null,
            pin_order: p.pin_order,
            tags: p.tags,
            is_transport: p.is_transport,
            latitude: p.latitude,
            longitude: p.longitude,
            original_creator_id: p.original_creator_id,
          })))
          .select();

        if (pinsError) throw pinsError;

        // Batch insert notes - map by pin_order to ensure correct matching
        if (insertedPins) {
          const allNotesToInsert: any[] = [];
          
          // Create a map of pin_order -> inserted pin for reliable matching
          const insertedPinsByOrder = new Map(
            insertedPins.map(p => [p.pin_order, p])
          );
          
          for (const pinData of pinsToInsert) {
            const insertedPin = insertedPinsByOrder.get(pinData.pin_order);
            if (insertedPin && pinData.notes && pinData.notes.length > 0) {
              for (const note of pinData.notes) {
                allNotesToInsert.push({
                  route_id: route.id,
                  pin_id: insertedPin.id,
                  text: note.text,
                  image_url: note.imageUrl,
                  note_order: note.note_order,
                });
              }
            }
          }
          if (allNotesToInsert.length > 0) {
            await supabase.from("route_notes").insert(allNotesToInsert);
          }
        }
      }

      setLastAutoSave(new Date());
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      saveInProgressRef.current = false;
      setAutoSaving(false);
    }
  }, [user, title, description, routeDescription, pins, routeRating, tripType, saving]);

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
        // Save backup to localStorage before auto-save attempt
        try {
          localStorage.setItem('route_draft_backup', JSON.stringify({
            title,
            pins,
            routeDescription,
            tripType,
            routeRating,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error("localStorage backup failed:", e);
        }
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

  // Show draft dialog when draft is available (instead of auto-loading)
  useEffect(() => {
    if (userDraft && !id && !draftDecisionMade) {
      setPendingDraft(userDraft);
      setShowDraftDialog(true);
    }
  }, [userDraft, id, draftDecisionMade]);

  // Function to load the pending draft
  const loadDraft = () => {
    if (!pendingDraft) return;
    
    // Set loading flag to block auto-save during draft load
    draftLoadingRef.current = true;
    routeIdRef.current = pendingDraft.id;
    setTitle(pendingDraft.title);
    setDescription(pendingDraft.description || "");
    setRouteDescription(pendingDraft.description || "");
    setTripType(pendingDraft.trip_type || "completed");
    setRouteRating(pendingDraft.rating || 0);
    
    if (pendingDraft.pins?.length > 0) {
      const pinNotes = pendingDraft.pin_notes || [];
      setPins(
        pendingDraft.pins
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
    
    setDraftDecisionMade(true);
    setShowDraftDialog(false);
    setPendingDraft(null);
    
    // Clear loading flag after state is set (use setTimeout to ensure React has processed state updates)
    setTimeout(() => {
      draftLoadingRef.current = false;
      console.log("Draft loaded, auto-save enabled");
    }, 500);
    
    toast({
      title: "Wersja robocza została wczytana",
      description: "Kontynuujesz edycję ostatniej trasy",
    });
  };

  // Function to start a new route (delete existing draft)
  const startNewRoute = async () => {
    if (pendingDraft && user) {
      // Delete the draft from database
      await supabase.from("pins").delete().eq("route_id", pendingDraft.id);
      await supabase.from("route_notes").delete().eq("route_id", pendingDraft.id);
      await supabase.from("routes").delete().eq("id", pendingDraft.id).eq("user_id", user.id);
    }
    
    resetFormState();
    setDraftDecisionMade(true);
    setShowDraftDialog(false);
    setPendingDraft(null);
    
    toast({
      title: "Nowa trasa",
      description: "Możesz rozpocząć tworzenie nowej trasy",
    });
  };

  useEffect(() => {
    if (existingRoute) {
      // Block auto-save during existing route load
      draftLoadingRef.current = true;
      
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
      
      // Enable auto-save after state is set
      setTimeout(() => {
        draftLoadingRef.current = false;
        console.log("Existing route loaded, auto-save enabled");
      }, 500);
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
    const removedPin = pins[index];
    const newPins = pins.filter((_, i) => i !== index).map((pin, i) => ({ ...pin, pin_order: i }));
    
    // Store deleted pin for potential undo
    setDeletedPinBuffer(removedPin);
    setDeletedPinIndex(index);
    
    setPins(newPins);
    if (currentPinIndex >= newPins.length) {
      setCurrentPinIndex(Math.max(0, newPins.length - 1));
    }
    
    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    // Show toast with undo option
    toast({
      title: "Pinezka usunięta",
      description: `${removedPin.place_name || removedPin.address || "Pinezka"} została usunięta`,
      action: (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleUndoDelete(removedPin, index, newPins)}
        >
          Cofnij
        </Button>
      ),
      duration: 5000,
    });
    
    // Clear buffer after 5 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setDeletedPinBuffer(null);
      setDeletedPinIndex(null);
    }, 5000);
  };
  
  const handleUndoDelete = (pin: Pin, originalIndex: number, currentPins: Pin[]) => {
    // Clear the timeout since we're undoing
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    // Insert pin back at original position
    const newPins = [...currentPins];
    newPins.splice(originalIndex, 0, pin);
    
    // Re-index pin_order
    const reindexedPins = newPins.map((p, i) => ({ ...p, pin_order: i }));
    setPins(reindexedPins);
    
    // Clear buffer
    setDeletedPinBuffer(null);
    setDeletedPinIndex(null);
    
    toast({
      title: "Przywrócono pinezkę",
      description: `${pin.place_name || pin.address || "Pinezka"} została przywrócona`,
    });
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
    
    try {
      // Compress image before uploading
      const compressedBlob = await compressImage(file, 1920, 1920, 0.8);
      const fileName = `${user.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg"
        });

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
      
      toast({ title: "Zdjęcie dodane" });
    } catch (error) {
      console.error("Image compression error:", error);
      toast({ variant: "destructive", title: "Błąd podczas przetwarzania zdjęcia" });
    }
  };

  // Helper to find or create canonical pin for a location
  const findOrCreateCanonicalPin = async (
    latitude: number,
    longitude: number,
    placeName: string,
    address: string,
    userId: string
  ): Promise<string | null> => {
    try {
      console.log('Looking for canonical pin at:', latitude, longitude);
      
      // Call the SQL function to find nearby pin (within 50m)
      const { data: nearbyPinId, error: searchError } = await supabase
        .rpc('find_nearby_canonical_pin', {
          search_lat: latitude,
          search_lng: longitude,
          radius_meters: 50
        });

      if (searchError) {
        console.error('Error searching for nearby pin:', searchError);
        throw searchError;
      }

      // If found, return existing canonical pin ID
      if (nearbyPinId) {
        console.log('✓ Found existing canonical pin:', nearbyPinId);
        
        // Increment visit count
        const { error: updateError } = await supabase
          .from('canonical_pins')
          .update({ 
            total_visits: (await supabase.from('canonical_pins').select('total_visits').eq('id', nearbyPinId).single()).data?.total_visits + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', nearbyPinId);
        
        if (updateError) {
          console.warn('Failed to increment visit count:', updateError);
        }
        
        return nearbyPinId;
      }

      // If not found, create new canonical pin
      console.log('✓ Creating NEW canonical pin (first discovery!)');
      const { data: newPin, error: createError } = await supabase
        .from('canonical_pins')
        .insert({
          place_name: placeName,
          address: address,
          latitude: latitude,
          longitude: longitude,
          discovered_by_user_id: userId,
          discovered_at: new Date().toISOString(),
          total_visits: 1,
          average_rating: 0
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating canonical pin:', createError);
        throw createError;
      }

      console.log('✓ New canonical pin created:', newPin.id);
      return newPin.id;
    } catch (error) {
      console.error('Error in findOrCreateCanonicalPin:', error);
      // Return null instead of throwing - route can still be saved without canonical pin
      return null;
    }
  };

  const saveRoute = async (status: "draft" | "published") => {
    if (!user || !title.trim()) {
      toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
      return;
    }

    // Prevent concurrent saves
    if (saveInProgressRef.current) {
      toast({ title: "Zapis w toku, poczekaj..." });
      return;
    }

    // For drafts, keep pins with any data; for published, require address
    const pinsToSave = status === "published" 
      ? pins.filter(p => p.address)
      : pins.filter(p => p.address || p.place_name || p.description || p.latitude || p.images.length > 0);

    const validPins = pinsToSave.map(p => ({
      ...p,
      place_name: p.place_name || p.address || "Nowy pin"
    }));
    
    if (validPins.length === 0) {
      toast({ variant: "destructive", title: "Dodaj przynajmniej jedną pinezkę" });
      return;
    }

    // Rating is now optional - no validation needed

    saveInProgressRef.current = true;
    setSaving(true);

    try {
      let routeId = id;

      // Prepare all pins data BEFORE any database operations
      const pinsToInsert = await Promise.all(validPins.map(async (pin) => {
        // Find or create canonical pin for this location
        let canonicalPinId: string | null = null;
        
        if (pin.latitude && pin.longitude) {
          try {
            canonicalPinId = await findOrCreateCanonicalPin(
              pin.latitude,
              pin.longitude,
              pin.place_name || pin.address || "Nowe miejsce",
              pin.address || "Brak adresu",
              user.id
            );
            
            console.log(`Pin "${pin.place_name}" → Canonical ID: ${canonicalPinId || 'none'}`);
          } catch (error) {
            console.error('Failed to find/create canonical pin:', error);
            // Continue without canonical pin if there's an error
          }
        }
        
        // Process note images upfront
        const processedNotes = pin.notes ? await Promise.all(pin.notes.map(async (note) => {
          let imageUrl = note.imageUrl;
          if (imageUrl && imageUrl.startsWith("data:")) {
            const uploaded = await uploadNoteImage(imageUrl);
            imageUrl = uploaded || undefined;
          }
          return { ...note, imageUrl };
        })) : [];

        return {
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
          canonical_pin_id: canonicalPinId,
          visited_at: new Date().toISOString(),
          notes: processedNotes,
        };
      }));

      // Use routeIdRef.current (from auto-save) OR id from URL params
      const existingRouteId = routeIdRef.current || id;

      if (existingRouteId) {
        const { error: routeError } = await supabase
          .from("routes")
          .update({ title, description: routeDescription || description, status, rating: routeRating, trip_type: tripType || 'completed' })
          .eq("id", existingRouteId);

        if (routeError) throw routeError;
        routeId = existingRouteId;

        // Delete existing pins (cascades to route_notes via FK)
        await supabase.from("pins").delete().eq("route_id", existingRouteId);

        // BATCH INSERT - single request for all pins
        const { data: insertedPins, error: pinsError } = await supabase
          .from("pins")
          .insert(pinsToInsert.map(p => ({
            route_id: existingRouteId,
            place_name: p.place_name,
            address: p.address,
            description: p.description,
            image_url: p.image_url,
            images: p.images,
            rating: p.rating || null,
            pin_order: p.pin_order,
            tags: p.tags,
            is_transport: p.is_transport,
            transport_type: p.transport_type,
            transport_end: p.transport_end,
            mentioned_users: p.mentioned_users,
            latitude: p.latitude,
            longitude: p.longitude,
            canonical_pin_id: p.canonical_pin_id,
            visited_at: p.visited_at,
          })))
          .select();

        if (pinsError) throw pinsError;

        // Fire translations and collect notes - map by pin_order to ensure correct matching
        if (insertedPins) {
          const allNotesToInsert: any[] = [];
          
          // Create a map of pin_order -> inserted pin for reliable matching
          const insertedPinsByOrder = new Map(
            insertedPins.map(p => [p.pin_order, p])
          );
          
          for (const pinData of pinsToInsert) {
            const insertedPin = insertedPinsByOrder.get(pinData.pin_order);
            if (!insertedPin) continue;
            
            // Trigger async translation (fire-and-forget)
            if (pinData.place_name) {
              supabase.functions.invoke('translate-place', {
                body: { 
                  pin_id: insertedPin.id, 
                  place_name: pinData.place_name,
                  address: pinData.address 
                }
              }).catch(err => console.log('Translation request failed:', err));
            }

            // Collect notes for batch insert
            if (pinData.notes && pinData.notes.length > 0) {
              for (const note of pinData.notes) {
                allNotesToInsert.push({
                  route_id: existingRouteId,
                  pin_id: insertedPin.id,
                  text: note.text,
                  image_url: note.imageUrl,
                  note_order: note.note_order,
                });
              }
            }
          }
          
          // Batch insert all notes
          if (allNotesToInsert.length > 0) {
            await supabase.from("route_notes").insert(allNotesToInsert);
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
        routeIdRef.current = route.id; // Store for future saves

        // BATCH INSERT - single request for all pins
        const { data: insertedPins, error: pinsError } = await supabase
          .from("pins")
          .insert(pinsToInsert.map(p => ({
            route_id: route.id,
            place_name: p.place_name,
            address: p.address,
            description: p.description,
            image_url: p.image_url,
            images: p.images,
            rating: p.rating || null,
            pin_order: p.pin_order,
            tags: p.tags,
            is_transport: p.is_transport,
            transport_type: p.transport_type,
            transport_end: p.transport_end,
            mentioned_users: p.mentioned_users,
            latitude: p.latitude,
            longitude: p.longitude,
            canonical_pin_id: p.canonical_pin_id,
            visited_at: p.visited_at,
          })))
          .select();

        if (pinsError) throw pinsError;

        // Fire translations and collect notes - map by pin_order to ensure correct matching
        if (insertedPins) {
          const allNotesToInsert: any[] = [];
          
          // Create a map of pin_order -> inserted pin for reliable matching
          const insertedPinsByOrder = new Map(
            insertedPins.map(p => [p.pin_order, p])
          );
          
          for (const pinData of pinsToInsert) {
            const insertedPin = insertedPinsByOrder.get(pinData.pin_order);
            if (!insertedPin) continue;
            
            // Trigger async translation (fire-and-forget)
            if (pinData.place_name) {
              supabase.functions.invoke('translate-place', {
                body: { 
                  pin_id: insertedPin.id, 
                  place_name: pinData.place_name,
                  address: pinData.address 
                }
              }).catch(err => console.log('Translation request failed:', err));
            }

            // Collect notes for batch insert
            if (pinData.notes && pinData.notes.length > 0) {
              for (const note of pinData.notes) {
                allNotesToInsert.push({
                  route_id: route.id,
                  pin_id: insertedPin.id,
                  text: note.text,
                  image_url: note.imageUrl,
                  note_order: note.note_order,
                });
              }
            }
          }
          
          // Batch insert all notes
          if (allNotesToInsert.length > 0) {
            await supabase.from("route_notes").insert(allNotesToInsert);
          }
        }
      }

      const isUpdating = !!existingRouteId;
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
      saveInProgressRef.current = false;
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

      {/* Step Progress Indicator */}
      <div className="sticky top-[57px] bg-background border-b border-border py-3 px-4 z-10">
        <div className="max-w-lg mx-auto">
          <StepIndicator
            steps={[
              { label: "Info" },
              { label: "Pinezki" },
              { label: "Gotowe" },
            ]}
            currentStep={step}
          />
        </div>
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
              variant="default"
              className="w-full"
              onClick={() => {
                if (!title.trim()) {
                  toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
                  return;
                }
                setStep(2);
              }}
            >
              Kontynuj
            </Button>
          </div>
        ) : step === 2 ? (
          <>
            {showPinsList ? (
              pins.filter(p => p.address).length > 0 ? (
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
                <EmptyState
                  icon={MapPin}
                  title="Brak pinezek w trasie"
                  description="Dodaj pierwsze miejsca, które chcesz uwzględnić w swojej trasie"
                  actionLabel="Dodaj pierwszą pinezkę"
                  actionIcon={Plus}
                  onAction={() => {
                    addPin();
                    setShowPinsList(false);
                  }}
                  className="py-12"
                />
              )
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
                    
                    {/* Discovery Achievement Card */}
                    {pins[currentPinIndex]?.original_creator_id === user?.id && (
                      <div className="mt-3 animate-scale-in bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-4 shadow-md">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 animate-bounce">
                            <Trophy className="h-8 w-8 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
                              🎉 Gratulacje!
                            </h3>
                            <p className="text-sm text-amber-800 dark:text-amber-200 mt-0.5">
                              Jesteś pierwszym odkrywcą tego miejsca!
                            </p>
                            <span className="inline-block mt-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-200/50 dark:bg-amber-800/40 px-2 py-0.5 rounded-full">
                              Zdobyty: {new Date().toLocaleDateString('pl-PL')}
                            </span>
                          </div>
                        </div>
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
                    <DebouncedTextarea
                      value={pins[currentPinIndex]?.description || ""}
                      onChange={(value) => updatePin(currentPinIndex, "description", value)}
                      placeholder="Wpisz notatki o tym miejscu..."
                      rows={3}
                      maxWords={150}
                      debounceMs={500}
                    />
                  </div>


                  {/* Rating - centered - hidden for planning mode */}
                  {tripType !== "planning" && (
                    <div className="py-2">
                      <StarRating
                        rating={pins[currentPinIndex]?.rating || 0}
                        onRatingChange={(rating) => updatePin(currentPinIndex, "rating", rating)}
                        size="lg"
                        interactive={true}
                        showLabel={true}
                        showValue={true}
                        showReset={true}
                      />
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
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-sm font-medium">Kategoria (Opcjonalne)</Label>
                      {(pins[currentPinIndex]?.tags?.length || 0) > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updatePin(currentPinIndex, "tags", [])}
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                        >
                          Wyczyść wszystkie
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Możesz wybrać kilka kategorii
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
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
                          <button
                            key={name}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-sm font-medium transition-all duration-150",
                              isSelected
                                ? "bg-foreground text-background border-2 border-foreground"
                                : "bg-background text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground"
                            )}
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
                            {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                          </button>
                        );
                      })}
                      
                      {/* Divider */}
                      <div className="w-px h-8 bg-border self-center mx-1" />
                      
                      {/* "Inne" tag - opens custom input inline */}
                      {showCustomTagInput ? (
                        <Input
                          autoFocus
                          placeholder="Wpisz i naciśnij Enter"
                          className="h-10 w-44 rounded-full"
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
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-sm font-medium bg-background text-muted-foreground border border-dashed border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => setShowCustomTagInput(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Inne
                        </button>
                      )}
                    </div>
                    
                    {/* Custom tags display */}
                    {pins[currentPinIndex]?.tags?.filter(
                      tag => !["Restauracja", "Kawiarnia", "Jedzenie", "Zakupy", "Pamiątki", "Herbata", "Góry", "Morze"].includes(tag)
                    ).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground self-center mr-1">Własne:</span>
                        {pins[currentPinIndex]?.tags?.filter(
                          tag => !["Restauracja", "Kawiarnia", "Jedzenie", "Zakupy", "Pamiątki", "Herbata", "Góry", "Morze"].includes(tag)
                        ).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            className="inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-sm font-medium bg-foreground text-background border-2 border-foreground transition-all duration-150"
                            onClick={() => {
                              const currentTags = pins[currentPinIndex]?.tags || [];
                              updatePin(currentPinIndex, "tags", currentTags.filter(t => t !== tag));
                            }}
                          >
                            {tag}
                            <X className="h-3 w-3 ml-0.5" />
                          </button>
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
                      // Rating is now optional - no validation needed
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
            <div className="space-y-4 pb-24">
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
                <p className="text-sm text-muted-foreground">
                  {pins.filter(p => p.address).length} {pins.filter(p => p.address).length === 1 ? 'punkt' : 'punktów'}
                </p>
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
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setRouteDescription(e.target.value);
                    }
                  }}
                  placeholder="Podziel się ogólnymi wrażeniami i najważniejszymi szczegółami..."
                  rows={3}
                  className="resize-none text-sm"
                  maxLength={500}
                />
                <p className={`text-xs font-medium transition-colors ${
                  routeDescription.length >= 500 
                    ? "text-destructive" 
                    : routeDescription.length >= 450 
                      ? "text-orange-600" 
                      : routeDescription.length >= 400 
                        ? "text-amber-600" 
                        : "text-muted-foreground"
                }`}>
                  {routeDescription.length >= 500 && (
                    <span className="mr-1">Osiągnięto limit •</span>
                  )}
                  {routeDescription.length}/500 znaków
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
                // Navigation happens inside saveRoute, no need to close dialog
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

      {/* Draft Found Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Znaleziono wersję roboczą</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Masz zapisaną wersję roboczą trasy:</p>
                {pendingDraft && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="font-medium text-foreground">{pendingDraft.title || "Bez tytułu"}</p>
                    <p className="text-sm text-muted-foreground">
                      {pendingDraft.pins?.length || 0} {pendingDraft.pins?.length === 1 ? "pinezka" : "pinezek"}
                    </p>
                  </div>
                )}
                <p>Czy chcesz kontynuować edycję, czy zacząć nową trasę?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                loadDraft();
              }}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Kontynuuj wersję roboczą
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                startNewRoute();
              }}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Zacznij nową trasę
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateRoute;
