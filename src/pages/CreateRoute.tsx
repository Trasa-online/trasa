import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, X, Camera, Car, Train, Bus, Ship, Bike, Tag, Plane, Coffee, UtensilsCrossed, ShoppingBag, Gift, Mountain, Waves } from "lucide-react";
import StarRating from "@/components/route/StarRating";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import UserMentionInput from "@/components/route/UserMentionInput";

type PinType = "transport" | "tag" | null;

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
  is_transport: boolean;
  transport_type: string;
  transport_end: string;
  pin_type?: PinType;
  mentioned_users: string[];
}

const CreateRoute = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pins, setPins] = useState<Pin[]>([
    { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: 0, tags: [], is_transport: false, transport_type: "", transport_end: "", pin_type: null, mentioned_users: [] },
  ]);
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [routeDescription, setRouteDescription] = useState("");
  const [routeRating, setRouteRating] = useState(0);
  const [showCustomTransportInput, setShowCustomTransportInput] = useState(false);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [noAddressRemembered, setNoAddressRemembered] = useState(false);
  const [showPinsList, setShowPinsList] = useState(false);

  useEffect(() => {
    // Reset "no address" checkbox when changing pins
    setNoAddressRemembered(pins[currentPinIndex]?.address === "Brak adresu");
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
      return data;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (existingRoute) {
      setTitle(existingRoute.title);
      setDescription(existingRoute.description || "");
      if (existingRoute.pins?.length > 0) {
        setPins(
          existingRoute.pins
            .sort((a: any, b: any) => a.pin_order - b.pin_order)
            .map((pin: any) => ({
              ...pin,
              mentioned_users: pin.mentioned_users || [],
              images: pin.images || [],
              // Explicit type conversions from nullable database types
              is_transport: !!pin.is_transport,
              rating: typeof pin.rating === 'number' ? pin.rating : 0,
              // Infer pin type for existing routes based on is_transport flag
              pin_type: pin.is_transport ? "transport" : "tag",
            }))
        );
        // Show pins list when editing existing route with pins
        setShowPinsList(true);
      }
      // When editing existing route, skip to step 2 to show pins list
      setStep(2);
    }
  }, [existingRoute]);

  // Auto-calculate route rating based on pins (only non-transport pins with ratings)
  useEffect(() => {
    const validPins = pins.filter(p => !p.is_transport && p.rating > 0);
    if (validPins.length > 0) {
      const avgRating = validPins.reduce((sum, pin) => sum + pin.rating, 0) / validPins.length;
      setRouteRating(Math.round(avgRating * 10) / 10);
    } else {
      setRouteRating(0);
    }
  }, [pins]);

  const addPin = () => {
    setPins([...pins, { place_name: "", address: "", description: "", image_url: "", images: [], rating: 0, pin_order: pins.length, tags: [], is_transport: false, transport_type: "", transport_end: "", pin_type: null, mentioned_users: [] }]);
    setCurrentPinIndex(pins.length);
  };

  const removePin = (index: number) => {
    const newPins = pins.filter((_, i) => i !== index).map((pin, i) => ({ ...pin, pin_order: i }));
    setPins(newPins);
    if (currentPinIndex >= newPins.length) {
      setCurrentPinIndex(Math.max(0, newPins.length - 1));
    }
  };

  const updatePin = (index: number, field: keyof Pin, value: any) => {
    const newPins = [...pins];
    newPins[index] = { ...newPins[index], [field]: value };
    setPins(newPins);
  };

  const handleImageUpload = async (files: FileList, pinIndex: number) => {
    if (!user) return;

    const file = files[0]; // Only take first file
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

    updatePin(pinIndex, "image_url", publicUrl);
    updatePin(pinIndex, "images", [publicUrl]);
  };

  const saveRoute = async (status: "draft" | "published") => {
    if (!user || !title.trim()) {
      toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
      return;
    }

    // Filter valid pins (with type set and either place_name or transport_type)
    const validPins = pins.filter(p => p.pin_type !== null && (p.place_name || p.transport_type));
    
    if (validPins.length === 0) {
      toast({ variant: "destructive", title: "Dodaj przynajmniej jedną pinezkę" });
      return;
    }

    // Validate that attraction pins have ratings when publishing
    if (status === "published") {
      const attractionsWithoutRating = validPins.filter(p => !p.is_transport && p.rating <= 0);
      if (attractionsWithoutRating.length > 0) {
        toast({ 
          variant: "destructive", 
          title: "Wszystkie atrakcje muszą mieć ocenę", 
          description: "Dodaj ocenę do wszystkich pinezek atrakcji przed publikacją"
        });
        return;
      }
    }

    setSaving(true);

    try {
      if (id) {
        const { error: routeError } = await supabase
          .from("routes")
          .update({ title, description, status, rating: routeRating })
          .eq("id", id);

        if (routeError) throw routeError;

        await supabase.from("pins").delete().eq("route_id", id);

        for (const pin of validPins) {
          const { error: pinError } = await supabase.from("pins").insert({
            route_id: id,
            place_name: pin.place_name || pin.transport_type || "",
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.is_transport ? null : pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: pin.is_transport,
            transport_type: pin.transport_type,
            transport_end: pin.transport_end,
            mentioned_users: pin.mentioned_users,
          });
          if (pinError) throw pinError;
        }
      } else {
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ user_id: user.id, title, description, status, rating: routeRating })
          .select()
          .single();

        if (routeError) throw routeError;

        for (const pin of validPins) {
          const { error: pinError } = await supabase.from("pins").insert({
            route_id: route.id,
            place_name: pin.place_name || pin.transport_type || "",
            address: pin.address || "Brak adresu",
            description: pin.description,
            image_url: pin.image_url,
            images: pin.images || [],
            rating: pin.is_transport ? null : pin.rating,
            pin_order: pin.pin_order,
            tags: pin.tags,
            is_transport: pin.is_transport,
            transport_type: pin.transport_type,
            transport_end: pin.transport_end,
            mentioned_users: pin.mentioned_users,
          });
          if (pinError) throw pinError;
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
        <button onClick={() => {
          if (step === 3) {
            setStep(2);
            setShowPinsList(true);
          } else if (step === 2) {
            if (showPinsList) {
              setStep(1);
            } else {
              setShowPinsList(true);
            }
          } else {
            navigate(-1);
          }
        }}>
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
              <Label htmlFor="title">Nazwa trasy *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Ukryte skarby Tokio"
              />
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
            {/* Show pins list when editing or after adding pins */}
            {showPinsList && pins.filter(p => p.pin_type !== null).length > 0 ? (
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

                <div className="space-y-3">
                  {pins.filter(p => p.pin_type !== null).map((pin, index) => {
                    const actualIndex = pins.findIndex(p => p.pin_order === pin.pin_order);
                    return (
                      <div
                        key={index}
                        className="border border-border rounded-lg p-3 bg-card cursor-pointer hover:border-primary transition-colors"
                        onClick={() => {
                          setCurrentPinIndex(actualIndex);
                          setShowPinsList(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            {pin.is_transport ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Car className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{pin.transport_type || "Transport"}</span>
                                </div>
                                <p className="text-sm font-medium">{pin.place_name} → {pin.transport_end}</p>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">{pin.place_name}</p>
                                  {pin.rating > 0 && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className="text-yellow-500">★</span>
                                      <span>{pin.rating.toFixed(1)}</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{pin.address}</p>
                              </>
                            )}
                            
                            {pin.tags && pin.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {pin.tags.slice(0, 3).map((tag, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                                {pin.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    +{pin.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePin(actualIndex);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setStep(3)}
                    disabled={pins.filter(p => p.pin_type !== null && (p.place_name || p.transport_type)).length === 0}
                  >
                    Przejdź do podsumowania
                  </Button>
                </div>
              </div>
            ) : pins[currentPinIndex]?.pin_type === null ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold">Co się wydarzyło?</h2>
                  <p className="text-muted-foreground">
                    Wybierz typ punktu, który chcesz dodać
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-24 flex-col gap-2 hover:border-primary"
                    onClick={() => {
                      const newPins = [...pins];
                      newPins[currentPinIndex] = { 
                        ...newPins[currentPinIndex], 
                        pin_type: "transport",
                        is_transport: true 
                      };
                      setPins(newPins);
                    }}
                  >
                    <Car className="h-8 w-8" />
                    <span className="font-medium">Transport</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-24 flex-col gap-2 hover:border-primary"
                    onClick={() => {
                      const newPins = [...pins];
                      newPins[currentPinIndex] = { 
                        ...newPins[currentPinIndex], 
                        pin_type: "tag",
                        is_transport: false 
                      };
                      setPins(newPins);
                    }}
                  >
                    <Tag className="h-8 w-8" />
                    <span className="font-medium">Atrakcja</span>
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

                  {/* Change pin type button */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const newPins = [...pins];
                        newPins[currentPinIndex] = {
                          ...newPins[currentPinIndex],
                          pin_type: newPins[currentPinIndex].pin_type === "transport" ? "tag" : "transport",
                          is_transport: newPins[currentPinIndex].pin_type !== "transport",
                          // Reset relevant fields when switching
                          ...(newPins[currentPinIndex].pin_type === "transport" 
                            ? { transport_type: "", transport_end: "", rating: 0 } 
                            : { tags: [] })
                        };
                        setPins(newPins);
                      }}
                    >
                      {pins[currentPinIndex]?.pin_type === "transport" ? (
                        <>
                          <Tag className="h-4 w-4 mr-2" />
                          Zmień na Atrakcję
                        </>
                      ) : (
                        <>
                          <Car className="h-4 w-4 mr-2" />
                          Zmień na Transport
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {pins[currentPinIndex]?.pin_type === "transport" ? (
                      <>
                        {/* Transport type selection */}
                        <div>
                          <Label>Rodzaj transportu *</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              { name: "Samochód", icon: Car },
                              { name: "Tramwaj", icon: Train },
                              { name: "Autobus", icon: Bus },
                              { name: "Samolot", icon: Plane },
                              { name: "Prom", icon: Ship },
                              { name: "Rower", icon: Bike }
                            ].map(({ name, icon: Icon }) => (
                              <Badge
                                key={name}
                                variant={pins[currentPinIndex]?.transport_type === name ? "default" : "outline"}
                                className="cursor-pointer flex items-center gap-1"
                                onClick={() => updatePin(currentPinIndex, "transport_type", name)}
                              >
                                <Icon className="h-3 w-3" />
                                {name}
                              </Badge>
                            ))}
                            
                            {/* Custom transport type */}
                            {pins[currentPinIndex]?.transport_type && 
                             !["Samochód", "Tramwaj", "Autobus", "Samolot", "Prom", "Rower"].includes(pins[currentPinIndex].transport_type) && (
                              <Badge
                                variant="default"
                                className="cursor-pointer flex items-center gap-1"
                                onClick={() => {
                                  updatePin(currentPinIndex, "transport_type", "");
                                  setShowCustomTransportInput(false);
                                }}
                              >
                                {pins[currentPinIndex].transport_type} <X className="h-3 w-3 ml-1" />
                              </Badge>
                            )}
                            
                            {!showCustomTransportInput && (!pins[currentPinIndex]?.transport_type || ["Samochód", "Tramwaj", "Autobus", "Samolot", "Prom", "Rower"].includes(pins[currentPinIndex].transport_type)) ? (
                              <Badge
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => setShowCustomTransportInput(true)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Inne
                              </Badge>
                            ) : showCustomTransportInput && (
                              <div className="flex items-center gap-2 w-full">
                                <Input
                                  autoFocus
                                  placeholder="Wpisz własny rodzaj transportu"
                                  className="h-7"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                      updatePin(currentPinIndex, "transport_type", e.currentTarget.value.trim());
                                      setShowCustomTransportInput(false);
                                    } else if (e.key === 'Escape') {
                                      setShowCustomTransportInput(false);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.currentTarget.value.trim()) {
                                      updatePin(currentPinIndex, "transport_type", e.currentTarget.value.trim());
                                    }
                                    setShowCustomTransportInput(false);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Start and end points for transport */}
                        <div>
                          <Label>Punkt startowy *</Label>
                          <Input
                            value={pins[currentPinIndex]?.place_name || ""}
                            onChange={(e) => updatePin(currentPinIndex, "place_name", e.target.value)}
                            placeholder="Wpisz miejsce początkowe transportu"
                          />
                        </div>

                        <div>
                          <Label>Punkt końcowy *</Label>
                          <Input
                            value={pins[currentPinIndex]?.transport_end || ""}
                            onChange={(e) => updatePin(currentPinIndex, "transport_end", e.target.value)}
                            placeholder="Wpisz miejsce docelowe transportu"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Tag selection for attraction */}
                        <div>
                          <Label>Kategoria *</Label>
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
                                  className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 text-sm"
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
                            
                            {/* Custom tags */}
                            {pins[currentPinIndex]?.tags?.filter(
                              tag => !["Restauracja", "Kawiarnia", "Jedzenie", "Zakupy", "Pamiątki", "Herbata", "Góry", "Morze"].includes(tag)
                            ).map(tag => (
                              <Badge
                                key={tag}
                                variant="default"
                                className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 text-sm"
                                onClick={() => {
                                  const currentTags = pins[currentPinIndex]?.tags || [];
                                  updatePin(currentPinIndex, "tags", currentTags.filter(t => t !== tag));
                                }}
                              >
                                {tag} <X className="h-3.5 w-3.5 ml-1" />
                              </Badge>
                            ))}
                            
                            {!showCustomTagInput ? (
                              <Badge
                                variant="outline"
                                className="cursor-pointer px-3.5 py-2 text-sm"
                                onClick={() => setShowCustomTagInput(true)}
                              >
                                <Plus className="h-4 w-4 mr-1.5" />
                                Inne
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2 w-full">
                                <Input
                                  autoFocus
                                  placeholder="Wpisz własną kategorię"
                                  className="h-9"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                      const currentTags = pins[currentPinIndex]?.tags || [];
                                      updatePin(currentPinIndex, "tags", [...currentTags, e.currentTarget.value.trim()]);
                                      setShowCustomTagInput(false);
                                    } else if (e.key === 'Escape') {
                                      setShowCustomTagInput(false);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.currentTarget.value.trim()) {
                                      const currentTags = pins[currentPinIndex]?.tags || [];
                                      updatePin(currentPinIndex, "tags", [...currentTags, e.currentTarget.value.trim()]);
                                    }
                                    setShowCustomTagInput(false);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Regular pin fields */}
                        <div>
                          <Label>Nazwa pinezki *</Label>
                          <Input
                            value={pins[currentPinIndex]?.place_name || ""}
                            onChange={(e) => updatePin(currentPinIndex, "place_name", e.target.value)}
                            placeholder="Wpisz nazwę miejsca lub atrakcji"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Adres *</Label>
                          <Input
                            value={pins[currentPinIndex]?.address || ""}
                            onChange={(e) => updatePin(currentPinIndex, "address", e.target.value)}
                            placeholder="Wpisz adres lub lokalizację miejsca"
                            disabled={noAddressRemembered}
                          />
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="no-address"
                              checked={noAddressRemembered}
                              onCheckedChange={(checked) => {
                                setNoAddressRemembered(!!checked);
                                if (checked) {
                                  updatePin(currentPinIndex, "address", "Brak adresu");
                                }
                              }}
                            />
                            <label
                              htmlFor="no-address"
                              className="text-sm text-muted-foreground cursor-pointer"
                            >
                              Nie pamiętam adresu
                            </label>
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <Label>Opis (Opcjonalne)</Label>
                      <Textarea
                        value={pins[currentPinIndex]?.description || ""}
                        onChange={(e) => updatePin(currentPinIndex, "description", e.target.value)}
                        placeholder="Opisz miejsce, swoje wrażenia lub wspomnienia"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>Wspomnij znajomych (Opcjonalne)</Label>
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

                    {pins[currentPinIndex]?.pin_type === "tag" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Ocena *</Label>
                          <span className="text-sm font-medium flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            {(pins[currentPinIndex]?.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center py-4 gap-1">
                          <StarRating
                            rating={pins[currentPinIndex]?.rating || 0}
                            size="lg"
                            interactive
                            onRatingChange={(rating) => updatePin(currentPinIndex, "rating", rating)}
                          />
                          <p className="text-xs text-center text-muted-foreground">
                            Kliknij gwiazdki aby wybrać ocenę
                          </p>
                        </div>
                      </div>
                    )}

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
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-2 max-w-lg mx-auto">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
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
                  <span>{pins.filter(p => p.pin_type !== null && (p.place_name || p.transport_type)).length} {pins.filter(p => p.pin_type !== null).length === 1 ? 'punkt' : 'punktów'}</span>
                  {routeRating > 0 && (
                    <div className="flex items-center gap-1 text-foreground">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium">{routeRating.toFixed(1)}</span>
                      <span className="text-muted-foreground text-xs">Ogólna ocena</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Map placeholder */}
              <div className="relative h-40 bg-muted rounded-lg overflow-hidden border border-border">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
                  {/* Fake map pins */}
                  <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                  <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                  <div className="absolute bottom-1/3 right-1/3 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Podgląd lokalizacji na mapie</p>
                </div>
              </div>

              {/* Pins list */}
              {pins.filter(p => p.pin_type !== null && (p.place_name || p.transport_type)).map((pin, index) => (
                <div key={index} className="border border-border rounded-lg p-3 space-y-2 bg-card">
                  <div className="flex items-start gap-3">
                    {/* Pin number */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      {pin.is_transport ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{pin.transport_type}</span>
                          </div>
                          <p className="text-sm font-medium">{pin.place_name} → {pin.transport_end}</p>
                          {pin.address && (
                            <p className="text-xs text-muted-foreground">{pin.address}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{pin.place_name}</p>
                            {pin.rating > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-yellow-500">★</span>
                                <span>{pin.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{pin.address}</p>
                        </>
                      )}
                      
                      {pin.tags && pin.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pin.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {pin.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{pin.description}</p>
                      )}
                      
                      {pin.image_url && (
                        <div className="relative h-32 bg-muted rounded overflow-hidden mt-2">
                          <img src={pin.image_url} alt={pin.place_name} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Overall route rating - auto-calculated */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ogólna ocena trasy</Label>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    {routeRating.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ocena jest obliczana automatycznie na podstawie średniej z {pins.filter(p => !p.is_transport && p.rating > 0).length} {pins.filter(p => !p.is_transport && p.rating > 0).length === 1 ? 'ocenionej atrakcji' : 'ocenionych atrakcji'}
                </p>
                {pins.filter(p => !p.is_transport && p.rating > 0).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Uwzględnione oceny:</p>
                    <ul className="space-y-0.5 pl-4">
                      {pins.filter(p => !p.is_transport && p.rating > 0).map((pin, idx) => (
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

              {/* Optional route description */}
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
    </div>
  );
};

export default CreateRoute;
