import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, X, Camera, Coffee, UtensilsCrossed, ShoppingBag, Gift, Mountain, Waves } from "lucide-react";
import StarRating from "@/components/route/StarRating";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import UserMentionInput from "@/components/route/UserMentionInput";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RouteMap from "@/components/RouteMap";
import DraggablePinList from "@/components/route/DraggablePinList";
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
  mentioned_users: string[];
  latitude?: number;
  longitude?: number;
}

const CreateRoute = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pins, setPins] = useState<Pin[]>([
    { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: 0, tags: [], mentioned_users: [], latitude: undefined, longitude: undefined },
  ]);
  const [routeNotes, setRouteNotes] = useState<{ afterPinIndex: number; text: string; imageUrl?: string }[]>([]);
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [routeDescription, setRouteDescription] = useState("");
  const [routeRating, setRouteRating] = useState(0);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [noAddressRemembered, setNoAddressRemembered] = useState(false);
  const [showPinsList, setShowPinsList] = useState(false);
  const [showAltName, setShowAltName] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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
      // Step 1 - check if there are pins before navigating away
      if (hasAddedPins) {
        setShowExitConfirm(true);
      } else {
        navigate("/");
      }
    }
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    if (step === 1) {
      navigate("/");
    } else {
      setStep(1);
    }
  };

  useEffect(() => {
    setNoAddressRemembered(pins[currentPinIndex]?.address === "Brak adresu");
    setShowAltName(!!pins[currentPinIndex]?.place_name);
  }, [currentPinIndex, pins]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

      // Fetch route notes separately
      const { data: notes } = await supabase
        .from("route_notes")
        .select("*")
        .eq("route_id", id);

      return { ...data, route_notes: notes || [] };
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (existingRoute) {
      setTitle(existingRoute.title);
      setDescription(existingRoute.description || "");
      setRouteDescription(existingRoute.description || "");
      if (existingRoute.pins?.length > 0) {
        setPins(
          existingRoute.pins
            .sort((a: any, b: any) => a.pin_order - b.pin_order)
            .map((pin: any) => ({
              ...pin,
              mentioned_users: pin.mentioned_users || [],
              images: pin.images || [],
              rating: typeof pin.rating === 'number' ? pin.rating : 0,
            }))
        );
        setShowPinsList(true);
      }
      // Load route notes
      if (existingRoute.route_notes?.length > 0) {
        setRouteNotes(existingRoute.route_notes.map((n: any) => ({
          afterPinIndex: n.after_pin_index,
          text: n.text,
          imageUrl: n.image_url
        })));
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
    setPins([...pins, { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: pins.length, tags: [], mentioned_users: [], latitude: undefined, longitude: undefined }]);
    setCurrentPinIndex(pins.length);
  };

  const removePin = (index: number) => {
    const newPins = pins.filter((_, i) => i !== index).map((pin, i) => ({ ...pin, pin_order: i }));
    setPins(newPins);
    if (currentPinIndex >= newPins.length) {
      setCurrentPinIndex(Math.max(0, newPins.length - 1));
    }
    // Also update route notes indexes
    setRouteNotes(prev => prev
      .filter(n => n.afterPinIndex !== index - 1)
      .map(n => n.afterPinIndex > index ? { ...n, afterPinIndex: n.afterPinIndex - 1 } : n)
    );
  };

  const addRouteNote = async (afterIndex: number, note: string, imageUrl?: string) => {
    let uploadedImageUrl: string | undefined;
    
    if (imageUrl && imageUrl.startsWith("data:") && user) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileExt = "jpg";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, blob);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("route-images")
          .getPublicUrl(fileName);
        uploadedImageUrl = publicUrl;
      }
    }

    setRouteNotes(prev => [
      ...prev.filter(n => n.afterPinIndex !== afterIndex),
      { afterPinIndex: afterIndex, text: note, imageUrl: uploadedImageUrl }
    ]);
    
    toast({ title: "Dodano notatkę" });
  };

  const removeRouteNote = (afterIndex: number) => {
    setRouteNotes(prev => prev.filter(n => n.afterPinIndex !== afterIndex));
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

    if (status === "published") {
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
          .update({ title, description: routeDescription || description, status, rating: routeRating })
          .eq("id", id);

        if (routeError) throw routeError;

        await supabase.from("pins").delete().eq("route_id", id);

        for (const pin of validPins) {
          const { error: pinError } = await supabase.from("pins").insert({
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
            mentioned_users: pin.mentioned_users,
            latitude: pin.latitude,
            longitude: pin.longitude,
          });
          if (pinError) throw pinError;
        }
      } else {
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ user_id: user.id, title, description: routeDescription || description, status, rating: routeRating })
          .select()
          .single();

        if (routeError) throw routeError;
        routeId = route.id;

        for (const pin of validPins) {
          const { error: pinError } = await supabase.from("pins").insert({
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
            mentioned_users: pin.mentioned_users,
            latitude: pin.latitude,
            longitude: pin.longitude,
          });
          if (pinError) throw pinError;
        }
      }

      // Save route notes
      if (routeId) {
        // Delete existing notes first
        await supabase.from("route_notes").delete().eq("route_id", routeId);

        // Insert new notes
        for (const note of routeNotes) {
          await supabase.from("route_notes").insert({
            route_id: routeId,
            after_pin_index: note.afterPinIndex,
            text: note.text,
            image_url: note.imageUrl
          });
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
            {showPinsList && pins.filter(p => p.address).length > 0 ? (
              <div className="space-y-4 pb-24">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Pinezki w trasie</h2>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setShowPinsList(false);
                      addPin();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Dodaj
                  </Button>
                </div>

                <DraggablePinList
                  pins={pins}
                  onReorder={setPins}
                  onPinClick={(index) => {
                    setCurrentPinIndex(index);
                    setShowPinsList(false);
                  }}
                  onPinRemove={removePin}
                  routeNotes={routeNotes}
                  onAddNote={addRouteNote}
                  onRemoveNote={removeRouteNote}
                  showRemoveButton={true}
                  showInsertButtons={true}
                  compact={true}
                />

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

                  {/* Map preview */}
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
                    <AddressAutocomplete
                      value={pins[currentPinIndex]?.address || ""}
                      onChange={(value, coordinates) => {
                        setPins(prevPins => {
                          const newPins = [...prevPins];
                          newPins[currentPinIndex] = {
                            ...newPins[currentPinIndex],
                            address: value,
                            latitude: coordinates?.latitude,
                            longitude: coordinates?.longitude,
                          };
                          return newPins;
                        });
                      }}
                      placeholder="Wpisz adres miejsca"
                      disabled={noAddressRemembered}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        id="no-address"
                        checked={noAddressRemembered}
                        onCheckedChange={(checked) => {
                          setNoAddressRemembered(!!checked);
                          if (checked) {
                            updatePin(currentPinIndex, "address", "Brak adresu");
                          } else {
                            updatePin(currentPinIndex, "address", "");
                          }
                        }}
                      />
                      <label htmlFor="no-address" className="text-xs text-muted-foreground cursor-pointer">
                        Nie pamiętam adresu
                      </label>
                    </div>
                    
                    {/* Alternative pin name checkbox and input */}
                    <div className="flex items-center gap-2 mt-3">
                      <Checkbox
                        id="alt-name"
                        checked={showAltName || !!pins[currentPinIndex]?.place_name}
                        onCheckedChange={(checked) => {
                          setShowAltName(!!checked);
                          if (!checked) {
                            updatePin(currentPinIndex, "place_name", "");
                          }
                        }}
                      />
                      <label htmlFor="alt-name" className="text-xs text-muted-foreground cursor-pointer">
                        Alternatywna nazwa pina
                      </label>
                    </div>
                  </div>
                  
                  {/* Alternative pin name input - shows when checkbox is checked */}
                  {(showAltName || pins[currentPinIndex]?.place_name) && (
                    <div>
                      <Input
                        value={pins[currentPinIndex]?.place_name || ""}
                        onChange={(e) => updatePin(currentPinIndex, "place_name", e.target.value)}
                        placeholder="Wpisz alternatywną nazwę miejsca"
                      />
                    </div>
                  )}

                  {/* Description */}
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

                  {/* Friend mentions */}
                  <div>
                    <Label>Oznacz znajomych (Opcjonalne)</Label>
                    <UserMentionInput
                      selectedUserIds={pins[currentPinIndex]?.mentioned_users || []}
                      onUserSelect={(userId) => {
                        const currentUsers = pins[currentPinIndex]?.mentioned_users || [];
                        updatePin(currentPinIndex, "mentioned_users", [...currentUsers, userId]);
                      }}
                      onUserRemove={(userId) => {
                        const currentUsers = pins[currentPinIndex]?.mentioned_users || [];
                        updatePin(currentPinIndex, "mentioned_users", currentUsers.filter(id => id !== userId));
                      }}
                    />
                  </div>

                  {/* Rating - centered */}
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

                  {/* Image upload */}
                  <div>
                    <Label>Zdjęcie (Opcjonalne)</Label>
                    <div className="mt-2">
                      {pins[currentPinIndex]?.image_url ? (
                        <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                          <img
                            src={pins[currentPinIndex].image_url}
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

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-2 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      const currentPin = pins[currentPinIndex];
                      if (!currentPin?.address) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Adres jest wymagany przed dodaniem kolejnej pinezki"
                        });
                        return;
                      }
                      if (currentPin.rating <= 0) {
                        toast({ 
                          variant: "destructive", 
                          title: "Uzupełnij wymagane pola",
                          description: "Ocena jest wymagana przed dodaniem kolejnej pinezki"
                        });
                        return;
                      }
                      setShowPinsList(false);
                      addPin();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj kolejną pinezkę
                  </Button>
                  <Button
                    variant="outline"
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
                      if (currentPin.rating <= 0) {
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
                    Powrót do listy pinezek
                  </Button>
                </div>
              </>
            )}
          </>
        ) : step === 3 ? (
          <>
            <div className="space-y-4 pb-80">
              {/* Header */}
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">{title}</h2>
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

              {/* Pins list with notes */}
              <DraggablePinList
                pins={pins}
                onReorder={setPins}
                routeNotes={routeNotes}
                showRemoveButton={false}
                showInsertButtons={true}
                compact={false}
              />

              {/* Overall route rating */}
              <div className="space-y-3 border-t border-border pt-4">
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
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-2 max-w-lg mx-auto">
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => setStep(2)}
              >
                + Dodaj kolejną pinezkę
              </Button>
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
            <AlertDialogCancel>Zostań</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowExitConfirm(false);
                saveRoute("draft");
              }}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Zapisz i wyjdź
            </AlertDialogAction>
            <AlertDialogAction
              onClick={confirmExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Wyjdź bez zapisywania
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateRoute;
