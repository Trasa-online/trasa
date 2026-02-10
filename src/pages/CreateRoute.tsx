import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFolders } from "@/hooks/useFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


import { ArrowLeft, Plus, X, Camera, Pencil, Sparkles, Trophy, Check, MapPin, Star, Users } from "lucide-react";
import PlaceReviewCard from "@/components/route/PlaceReviewCard";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserMentionInput from "@/components/route/UserMentionInput";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RouteMap from "@/components/RouteMap";
import InteractiveRouteMap from "@/components/InteractiveRouteMap";
import DraggablePinList from "@/components/route/DraggablePinList";
import MapPinSelector from "@/components/route/MapPinSelector";
import PinNotesSection from "@/components/route/PinNotesSection";
import StepIndicator from "@/components/route/StepIndicator";
import RouteReviewSummary from "@/components/route/RouteReviewSummary";

import { findOriginalPinCreator, checkPinDiscoveryInfo, getCanonicalPinInfo, CanonicalPinInfo } from "@/lib/pinDiscovery";
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

import { NoteType } from "@/lib/noteTypes";

interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
  note_type: NoteType;
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
  // Canonical pin info for Single Source of Truth
  canonical_discoverer_avatar?: string;
  canonical_discovered_at?: string;
  canonical_total_visits?: number;
  canonical_average_rating?: number;
  // Review fields
  expectation_met: "yes" | "average" | "no" | null;
  pros: string[];
  cons: string[];
  trip_role: "must_see" | "nice_addition" | "skippable" | null;
  one_liner: string;
  recommended_for: string[];
}

const CreateRoute = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { folders } = useFolders();
  const [folderId, setFolderId] = useState<string | null>(searchParams.get("folder"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pins, setPins] = useState<Pin[]>([
    { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: 0, tags: [], latitude: undefined, longitude: undefined, notes: [], expectation_met: null, pros: [], cons: [], trip_role: null, one_liner: "", recommended_for: [] },
  ]);
  const [routeMentionedUsers, setRouteMentionedUsers] = useState<string[]>([]);
  // routeNotes state removed - notes are now stored per-pin
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [tripType, setTripType] = useState<"planning" | "ongoing" | "completed">("completed");
  const [step, setStep] = useState(1);
  const [routeDescription, setRouteDescription] = useState("");
  const [routeRating, setRouteRating] = useState(0);
  
  const [showPinsList, setShowPinsList] = useState(false);
  const [isNewDiscovery, setIsNewDiscovery] = useState<{ [key: number]: boolean }>({});
  
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
    // If on step 3 (summary), go back to step 2
    if (step === 3) {
      setStep(2);
      setShowPinsList(true);  // Always show list when going back to step 2
      return;
    }
    
    // If on step 2 (pins)
    if (step === 2) {
      // Check if user has added any pins with data
      if (hasAddedPins) {
        // Show confirmation dialog before losing work
        setShowExitConfirm(true);
      } else {
        // No work to lose, go back to step 1
        setStep(1);
      }
      return;
    }
    
    // If on step 1 (basics), navigate away
    // Check if there's any work that would be lost
    if (title.trim() || description.trim()) {
      setShowExitConfirm(true);
    } else {
      navigate("/feed");
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
      notes: [],
      expectation_met: null, pros: [], cons: [], trip_role: null, one_liner: "", recommended_for: []
    }]);
    setRouteMentionedUsers([]);
    setCurrentPinIndex(0);
    setStep(1);
    setTripType("completed");
    setShowPinsList(false);
    
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
          description: pin.one_liner || pin.description || "",
          image_url: pin.image_url,
          images: pin.images || [],
          rating: pin.expectation_met === "yes" ? 5 : pin.expectation_met === "average" ? 3 : pin.expectation_met === "no" ? 1 : (pin.rating || 0),
          pin_order: pin.pin_order,
          tags: [...(pin.pros || []), ...(pin.recommended_for || [])].length > 0 
            ? [...(pin.pros || []), ...(pin.recommended_for || [])] 
            : (pin.tags || []),
          is_transport: false,
          latitude: pin.latitude,
          longitude: pin.longitude,
          original_creator_id: originalCreatorId || user.id,
          notes: pin.notes,
          expectation_met: pin.expectation_met || null,
          pros: pin.pros || [],
          cons: pin.cons || [],
          trip_role: pin.trip_role || null,
          one_liner: pin.one_liner || "",
          recommended_for: pin.recommended_for || [],
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

        // Update existing route - preserve published status if editing published route
        const currentStatus = existingRoute?.status === "published" ? "published" : "draft";
        await supabase
          .from("routes")
          .update({ 
            title, 
            description: routeDescription || description, 
            status: currentStatus, 
            rating: routeRating, 
            trip_type: tripType || 'completed',
            folder_id: folderId || null
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
            expectation_met: p.expectation_met,
            pros: p.pros,
            cons: p.cons,
            trip_role: p.trip_role,
            one_liner: p.one_liner,
            recommended_for: p.recommended_for,
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
                  note_type: note.note_type || 'fact',
                });
              }
            }
          }
          if (allNotesToInsert.length > 0) {
            await supabase.from("route_notes").insert(allNotesToInsert);
          }
        }
      } else {
        // Calculate folder_order for new routes in a folder
        let autoSaveFolderOrder = 0;
        if (folderId) {
          const { data: existingRoutes } = await supabase
            .from("routes")
            .select("folder_order")
            .eq("folder_id", folderId)
            .order("folder_order", { ascending: false })
            .limit(1);
          autoSaveFolderOrder = (existingRoutes?.[0]?.folder_order ?? -1) + 1;
        }

        // Create new route
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ 
            user_id: user.id, 
            title, 
            description: routeDescription || description, 
            status: "draft", 
            rating: routeRating, 
            trip_type: tripType || 'completed',
            folder_id: folderId || null,
            folder_order: autoSaveFolderOrder
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
            expectation_met: p.expectation_met,
            pros: p.pros,
            cons: p.cons,
            trip_role: p.trip_role,
            one_liner: p.one_liner,
            recommended_for: p.recommended_for,
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
                  note_type: note.note_type || 'fact',
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
  }, [user, title, description, routeDescription, pins, routeRating, tripType, folderId, saving]);

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

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

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

  // Clear discovery status when pin location changes or is cleared
  useEffect(() => {
    const currentPin = pins[currentPinIndex];
    if (currentPin && !currentPin.latitude && !currentPin.longitude) {
      setIsNewDiscovery(prev => {
        const updated = { ...prev };
        delete updated[currentPinIndex];
        return updated;
      });
    }
  }, [pins, currentPinIndex]);

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
            expectation_met: pin.expectation_met || null,
            pros: pin.pros || [],
            cons: pin.cons || [],
            trip_role: pin.trip_role || null,
            one_liner: pin.one_liner || "",
            recommended_for: pin.recommended_for || [],
            notes: pinNotes
              .filter((n: any) => n.pin_id === pin.id)
              .sort((a: any, b: any) => a.note_order - b.note_order)
              .map((n: any) => ({
                id: n.id,
                text: n.text || "",
                imageUrl: n.image_url,
                note_order: n.note_order,
                note_type: n.note_type || 'fact',
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
      setFolderId(existingRoute.folder_id || null);
      if (existingRoute.pins?.length > 0) {
        const pinNotes = existingRoute.pin_notes || [];
        setPins(
          existingRoute.pins
            .sort((a: any, b: any) => a.pin_order - b.pin_order)
            .map((pin: any) => ({
              ...pin,
              images: pin.images || [],
              rating: typeof pin.rating === 'number' ? pin.rating : 0,
              expectation_met: pin.expectation_met || null,
              pros: pin.pros || [],
              cons: pin.cons || [],
              trip_role: pin.trip_role || null,
              one_liner: pin.one_liner || "",
              recommended_for: pin.recommended_for || [],
              notes: pinNotes
                .filter((n: any) => n.pin_id === pin.id)
                .sort((a: any, b: any) => a.note_order - b.note_order)
                .map((n: any) => ({
                  id: n.id,
                  text: n.text || "",
                  imageUrl: n.image_url,
                  note_order: n.note_order,
                  note_type: n.note_type || 'fact',
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
        notes: [],
        expectation_met: null,
        pros: [],
        cons: [],
        trip_role: null,
        one_liner: "",
        recommended_for: []
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

  const updatePin = useCallback((index: number, field: keyof Pin, value: any) => {
    setPins(prevPins => {
      const newPins = [...prevPins];
      newPins[index] = { ...newPins[index], [field]: value };
      return newPins;
    });
  }, []);

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
  ): Promise<{ id: string | null; isNewDiscovery: boolean }> => {
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
        
        return { id: nearbyPinId, isNewDiscovery: false };
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
      return { id: newPin.id, isNewDiscovery: true };
    } catch (error) {
      console.error('Error in findOrCreateCanonicalPin:', error);
      // Return null instead of throwing - route can still be saved without canonical pin
      return { id: null, isNewDiscovery: false };
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
            const result = await findOrCreateCanonicalPin(
              pin.latitude,
              pin.longitude,
              pin.place_name || pin.address || "Nowe miejsce",
              pin.address || "Brak adresu",
              user.id
            );
            
            canonicalPinId = result.id;
            
            // Track if this is a new discovery
            if (result.isNewDiscovery) {
              const pinIndex = pins.indexOf(pin);
              setIsNewDiscovery(prev => ({ ...prev, [pinIndex]: true }));
            }
            
            console.log(`Pin "${pin.place_name}" → Canonical ID: ${canonicalPinId || 'none'}, New Discovery: ${result.isNewDiscovery}`);
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
          description: pin.one_liner || pin.description || "",
          image_url: pin.image_url,
          images: pin.images || [],
          rating: pin.expectation_met === "yes" ? 5 : pin.expectation_met === "average" ? 3 : pin.expectation_met === "no" ? 1 : (pin.rating || 0),
          pin_order: pin.pin_order,
          tags: [...(pin.pros || []), ...(pin.recommended_for || [])].length > 0 
            ? [...(pin.pros || []), ...(pin.recommended_for || [])] 
            : (pin.tags || []),
          is_transport: false,
          transport_type: "",
          transport_end: "",
          mentioned_users: routeMentionedUsers,
          latitude: pin.latitude,
          longitude: pin.longitude,
          canonical_pin_id: canonicalPinId,
          visited_at: new Date().toISOString(),
          notes: processedNotes,
          expectation_met: pin.expectation_met || null,
          pros: pin.pros || [],
          cons: pin.cons || [],
          trip_role: pin.trip_role || null,
          one_liner: pin.one_liner || "",
          recommended_for: pin.recommended_for || [],
        };
      }));

      // Use routeIdRef.current (from auto-save) OR id from URL params
      const existingRouteId = routeIdRef.current || id;

      // Calculate folder_order for new routes in a folder
      let folderOrder = 0;
      if (folderId && !existingRouteId) {
        const { data: existingRoutes } = await supabase
          .from("routes")
          .select("folder_order")
          .eq("folder_id", folderId)
          .order("folder_order", { ascending: false })
          .limit(1);
        folderOrder = (existingRoutes?.[0]?.folder_order ?? -1) + 1;
      }

      if (existingRouteId) {
        const { error: routeError } = await supabase
          .from("routes")
          .update({ title, description: routeDescription || description, status, rating: routeRating, trip_type: tripType || 'completed', folder_id: folderId || null })
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
            expectation_met: p.expectation_met,
            pros: p.pros,
            cons: p.cons,
            trip_role: p.trip_role,
            one_liner: p.one_liner,
            recommended_for: p.recommended_for,
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
          .insert({ user_id: user.id, title, description: routeDescription || description, status, rating: routeRating, trip_type: tripType || 'completed', folder_id: folderId || null, folder_order: folderOrder })
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
            expectation_met: p.expectation_met,
            pros: p.pros,
            cons: p.cons,
            trip_role: p.trip_role,
            one_liner: p.one_liner,
            recommended_for: p.recommended_for,
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
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={handleBackClick} className="p-1 -ml-1 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-medium flex-1 text-foreground">
          {step === 1 ? "Nowa trasa" : step === 2 ? "Pinezki" : "Podsumowanie"}
        </h1>
        {step >= 2 && hasAddedPins && (
          <div className="text-[11px] text-muted-foreground text-right">
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
                Porzuć
              </button>
            )}
          </div>
        )}
      </div>

      {/* Step Progress Indicator */}
      <div className="sticky top-[49px] bg-background/95 backdrop-blur-sm border-b border-border/50 py-2.5 px-4 z-10">
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
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block mb-1.5">
                Nazwa trasy <span className="text-destructive">*</span>
              </label>
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
                className="text-base border-muted-foreground/20 focus:border-foreground"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {title.trim() ? title.trim().split(/\s+/).filter(w => w.length > 0).length : 0}/10 słów
              </p>
            </div>

            {/* Folder selector */}
            {folders.length > 0 && (
              <div>
                <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block mb-1.5">Folder</label>
                <select
                  value={folderId || ""}
                  onChange={(e) => setFolderId(e.target.value || null)}
                  className="w-full h-10 rounded-md border border-muted-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none transition-colors"
                >
                  <option value="">Bez folderu</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

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
                  <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Pinezki w trasie</h2>


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

                  <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 max-w-lg mx-auto">
                    <Button
                      variant="default"
                      className="w-full text-[13px]"
                      onClick={() => setStep(3)}
                      disabled={pins.filter(p => p.address).length === 0}
                    >
                      Dalej
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
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
                </div>
              )
            ) : (
              <>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
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
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">Podgląd mapy</label>
                      <RouteMap 
                        pins={pins.filter(p => p.latitude && p.longitude)}
                        className="h-32 rounded-lg"
                      />
                    </div>
                  )}

                  {/* Address - moved to top */}
                  <div>
                    <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block mb-1.5">
                      Adres <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={pins[currentPinIndex]?.address || ""}
                          onChange={async (value, coordinates, fullAddress, placeName) => {
                            // Get full canonical pin info
                            let canonicalInfo: CanonicalPinInfo = { isExisting: false };
                            if (coordinates?.latitude && coordinates?.longitude) {
                              canonicalInfo = await getCanonicalPinInfo(coordinates.latitude, coordinates.longitude);
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
                                  // Canonical pin data
                                  canonical_pin_id: canonicalInfo.canonicalPinId,
                                  original_creator_id: canonicalInfo.discoveredByUserId,
                                  original_creator_username: canonicalInfo.discoveredByUsername,
                                  canonical_discoverer_avatar: canonicalInfo.discoveredByAvatar,
                                  canonical_discovered_at: canonicalInfo.discoveredAt,
                                  canonical_total_visits: canonicalInfo.totalVisits,
                                  canonical_average_rating: canonicalInfo.averageRating,
                                };
                              }
                              return newPins;
                            });
                            
                            // Update discovery status
                            if (coordinates?.latitude && coordinates?.longitude) {
                              setIsNewDiscovery(prev => ({
                                ...prev,
                                [currentPinIndex]: !canonicalInfo.isExisting
                              }));
                            }
                          }}
                          placeholder="Wpisz adres miejsca"
                        />
                      </div>
                      <MapPinSelector
                        existingPins={pins.filter(p => p.latitude && p.longitude)}
                        onPinSelect={async (pinData) => {
                          // Get full canonical pin info
                          const canonicalInfo = await getCanonicalPinInfo(pinData.latitude, pinData.longitude);
                          
                          setPins(prevPins => {
                            const newPins = [...prevPins];
                            newPins[currentPinIndex] = {
                              ...newPins[currentPinIndex],
                              address: pinData.address,
                              place_name: pinData.place_name || pinData.address,
                              latitude: pinData.latitude,
                              longitude: pinData.longitude,
                              // Canonical pin data
                              canonical_pin_id: canonicalInfo.canonicalPinId,
                              original_creator_id: canonicalInfo.discoveredByUserId,
                              original_creator_username: canonicalInfo.discoveredByUsername,
                              canonical_discoverer_avatar: canonicalInfo.discoveredByAvatar,
                              canonical_discovered_at: canonicalInfo.discoveredAt,
                              canonical_total_visits: canonicalInfo.totalVisits,
                              canonical_average_rating: canonicalInfo.averageRating,
                            };
                            return newPins;
                          });
                          
                          // Update discovery status
                          setIsNewDiscovery(prev => ({
                            ...prev,
                            [currentPinIndex]: !canonicalInfo.isExisting
                          }));
                          
                          toast({ title: "Lokalizacja wybrana", description: pinData.place_name || pinData.address });
                        }}
                      />
                    </div>
                    
                    {/* New Discovery Badge - Clean */}
                    {pins[currentPinIndex]?.latitude && 
                     pins[currentPinIndex]?.longitude && 
                     isNewDiscovery[currentPinIndex] && (
                      <div className="mt-4 bg-muted/50 rounded-xl p-4 border border-border">
                        <p className="text-sm text-foreground font-medium mb-1">
                          Nowe miejsce na mapie
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Jesteś pierwszą osobą, która dodaje to miejsce. Zostaniesz zapisany jako odkrywca.
                        </p>
                      </div>
                    )}

                    {/* Existing Place Info Card - Single Source of Truth */}
                    {pins[currentPinIndex]?.canonical_pin_id && 
                     !isNewDiscovery[currentPinIndex] &&
                     pins[currentPinIndex]?.original_creator_id && (
                      <div className="mt-3 bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                        {/* Discoverer info */}
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-primary/20">
                            <AvatarImage src={pins[currentPinIndex]?.canonical_discoverer_avatar} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {pins[currentPinIndex]?.original_creator_username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />
                              <span className="text-muted-foreground">Odkryte przez</span>
                              <Link 
                                to={`/profile/${pins[currentPinIndex]?.original_creator_id}`}
                                className="font-semibold text-foreground hover:text-primary truncate"
                              >
                                @{pins[currentPinIndex]?.original_creator_username}
                              </Link>
                            </div>
                            {pins[currentPinIndex]?.canonical_discovered_at && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(pins[currentPinIndex]?.canonical_discovered_at!).toLocaleDateString('pl-PL', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-sm border-t border-border pt-3">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{pins[currentPinIndex]?.canonical_total_visits || 1}</span>
                            <span className="text-muted-foreground">
                              {(pins[currentPinIndex]?.canonical_total_visits || 1) === 1 ? 'wizyta' : 'wizyt'}
                            </span>
                          </div>
                          {(pins[currentPinIndex]?.canonical_average_rating || 0) > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Star className="h-4 w-4 fill-star text-star" />
                              <span className="font-medium">
                                {pins[currentPinIndex]?.canonical_average_rating?.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground">średnia</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Place name - editable */}
                  <div>
                    <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block mb-1.5">Nazwa miejsca</label>
                    <Input
                      value={pins[currentPinIndex]?.place_name || ""}
                      onChange={(e) => updatePin(currentPinIndex, "place_name", e.target.value)}
                      placeholder="np. Pałac Kultury"
                      className="border-muted-foreground/20 focus:border-foreground"
                    />
                  </div>


                  {/* PlaceReviewCard - replaces description, rating, and tags */}
                  <PlaceReviewCard
                    pin={pins[currentPinIndex]}
                    pinIndex={currentPinIndex}
                    totalPins={pins.length}
                    onUpdate={(field, value) => updatePin(currentPinIndex, field, value)}
                    tripType={tripType}
                  />

                  {/* Image upload - minimal */}
                  <div>
                    <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block mb-1.5">Zdjęcie</label>
                    {pins[currentPinIndex]?.image_url ? (
                      <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                        <img
                          src={pins[currentPinIndex]?.image_url}
                          alt="Podgląd"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updatePin(currentPinIndex, "image_url", "");
                            updatePin(currentPinIndex, "images", []);
                          }}
                          className="absolute top-2 right-2 bg-background/80 hover:bg-background p-1.5 rounded-full transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 border border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30 transition-all">
                        <Camera className="h-8 w-8 text-muted-foreground/50 mb-1.5" />
                        <p className="text-[13px] text-muted-foreground">
                          Dodaj zdjęcie
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

                <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      const currentPin = pins[currentPinIndex];
                      if (!currentPin?.address) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Adres jest wymagany"
                        });
                        return;
                      }
                      if (!currentPin?.recommended_for || currentPin.recommended_for.length === 0) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Wybierz dla kogo polecasz to miejsce"
                        });
                        return;
                      }
                      setShowPinsList(true);
                    }}
                  >
                    Gotowe
                  </Button>
                </div>
              </>
            )}
          </>
        ) : step === 3 ? (
          <>
            <div className="space-y-5 pb-24">
              {/* Header with editable title */}
              <div className="space-y-1.5">
                <label htmlFor="summary-title" className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">Nazwa trasy</label>
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
                  className="text-lg font-medium border-muted-foreground/20 focus:border-foreground"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {title.trim() ? title.trim().split(/\s+/).filter(w => w.length > 0).length : 0}/10 słów
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {pins.filter(p => p.address).length} {pins.filter(p => p.address).length === 1 ? 'punkt' : 'punktów'}
                  </p>
                </div>
              </div>

              {/* Route map */}
              <RouteMap 
                pins={pins.filter(p => p.address).map(p => ({ ...p, place_name: p.place_name || p.address }))}
                className="h-40 rounded-lg"
              />
              {/* Review summary stats */}
              <RouteReviewSummary pins={pins} />

              {/* Pins list - read-only summary */}
              <div>
                <DraggablePinList
                  pins={pins}
                  onReorder={setPins}
                  showRemoveButton={false}
                  showNotesEditor={false}
                  showNameEditor={false}
                  compact={false}
                />
              </div>

              {/* Route description */}
              <div className="space-y-1.5">
                <label htmlFor="route-description" className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">Opis trasy</label>
                <Textarea
                  id="route-description"
                  value={routeDescription}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setRouteDescription(e.target.value);
                    }
                  }}
                  placeholder="Podziel się wrażeniami..."
                  rows={3}
                  className="resize-none text-sm border-muted-foreground/20 focus:border-foreground"
                  maxLength={500}
                />
                <p className={`text-[10px] font-medium transition-colors ${
                  routeDescription.length >= 500 
                    ? "text-destructive" 
                    : "text-muted-foreground"
                }`}>
                  {routeDescription.length}/500
                </p>
              </div>

              {/* Friend mentions for route */}
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">Oznacz znajomych</label>
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

            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 max-w-lg mx-auto">
              <div className="flex gap-2">
                {existingRoute?.status === "published" ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 text-[13px]"
                      onClick={() => saveRoute("draft")}
                      disabled={saving}
                    >
                      Zapisz roboczą
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 text-[13px]"
                      onClick={() => saveRoute("published")}
                      disabled={saving}
                    >
                      Aktualizuj
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 text-[13px]"
                      onClick={() => saveRoute("draft")}
                      disabled={saving}
                    >
                      Robocza
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 text-[13px]"
                      onClick={() => saveRoute("published")}
                      disabled={saving}
                    >
                      Opublikuj
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
                // Preserve status: if editing published route, save as published
                const saveStatus = existingRoute?.status === "published" ? "published" : "draft";
                await saveRoute(saveStatus);
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
