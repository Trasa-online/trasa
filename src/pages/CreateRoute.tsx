import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    { place_name: "", address: "", description: "", image_url: "", rating: 0, pin_order: 0, tags: [], is_transport: false, transport_type: "", transport_end: "", pin_type: null, mentioned_users: [] },
  ]);
  const [currentPinIndex, setCurrentPinIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [routeDescription, setRouteDescription] = useState("");
  const [showCustomTransportInput, setShowCustomTransportInput] = useState(false);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);

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
        setPins(existingRoute.pins.sort((a: any, b: any) => a.pin_order - b.pin_order).map((pin: any) => ({
          ...pin,
          mentioned_users: pin.mentioned_users || []
        })));
      }
    }
  }, [existingRoute]);

  const addPin = () => {
    setPins([...pins, { place_name: "", address: "", description: "", image_url: "", rating: 0, pin_order: pins.length, tags: [], is_transport: false, transport_type: "", transport_end: "", pin_type: null, mentioned_users: [] }]);
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

  const handleImageUpload = async (file: File, pinIndex: number) => {
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
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
  };

  const saveRoute = async (status: "draft" | "published") => {
    if (!user || !title.trim()) {
      toast({ variant: "destructive", title: "Nazwa trasy jest wymagana" });
      return;
    }

    setSaving(true);

    try {
      if (id) {
        const { error: routeError } = await supabase
          .from("routes")
          .update({ title, description, status })
          .eq("id", id);

        if (routeError) throw routeError;

        await supabase.from("pins").delete().eq("route_id", id);

        for (const pin of pins) {
          if (pin.place_name && pin.address) {
            const { error: pinError } = await supabase.from("pins").insert({
              route_id: id,
              ...pin,
            });
            if (pinError) throw pinError;
          }
        }
      } else {
        const { data: route, error: routeError } = await supabase
          .from("routes")
          .insert({ user_id: user.id, title, description, status })
          .select()
          .single();

        if (routeError) throw routeError;

        for (const pin of pins) {
          if (pin.place_name && pin.address) {
            const { error: pinError } = await supabase.from("pins").insert({
              route_id: route.id,
              ...pin,
            });
            if (pinError) throw pinError;
          }
        }
      }

      toast({
        title: status === "published" ? "Trasa opublikowana!" : "Trasa zapisana jako wersja robocza",
      });
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
          if (step === 3) setStep(2);
          else if (step === 2) setStep(1);
          else navigate(-1);
        }}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex-1">
          {step === 1 ? "Utwórz nową trasę" : step === 2 ? title || "Edytuj trasę" : "Podsumowanie trasy"}
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
            {/* Pin type selection or pin form */}
            {pins[currentPinIndex]?.pin_type === null ? (
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
                                  placeholder="Wpisz transport"
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
                            placeholder="np. Dworzec Główny"
                          />
                        </div>

                        <div>
                          <Label>Punkt końcowy *</Label>
                          <Input
                            value={pins[currentPinIndex]?.transport_end || ""}
                            onChange={(e) => updatePin(currentPinIndex, "transport_end", e.target.value)}
                            placeholder="np. Lotnisko"
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
                                  className="cursor-pointer flex items-center gap-1"
                                  onClick={() => {
                                    const currentTags = pins[currentPinIndex]?.tags || [];
                                    const newTags = isSelected 
                                      ? currentTags.filter(t => t !== name)
                                      : [...currentTags, name];
                                    updatePin(currentPinIndex, "tags", newTags);
                                  }}
                                >
                                  <Icon className="h-3 w-3" />
                                  {name}
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
                                className="cursor-pointer flex items-center gap-1"
                                onClick={() => {
                                  const currentTags = pins[currentPinIndex]?.tags || [];
                                  updatePin(currentPinIndex, "tags", currentTags.filter(t => t !== tag));
                                }}
                              >
                                {tag} <X className="h-3 w-3 ml-1" />
                              </Badge>
                            ))}
                            
                            {!showCustomTagInput ? (
                              <Badge
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => setShowCustomTagInput(true)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Inne
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2 w-full">
                                <Input
                                  autoFocus
                                  placeholder="Wpisz kategorię"
                                  className="h-7"
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
                            placeholder="np. Kiyomizu-dera"
                          />
                        </div>

                        <div>
                          <Label>Adres *</Label>
                          <Input
                            value={pins[currentPinIndex]?.address || ""}
                            onChange={(e) => updatePin(currentPinIndex, "address", e.target.value)}
                            placeholder="np. Chrome-294 Kiyomizu"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label>Opis (Opcjonalne)</Label>
                      <Textarea
                        value={pins[currentPinIndex]?.description || ""}
                        onChange={(e) => updatePin(currentPinIndex, "description", e.target.value)}
                        placeholder="Opisz swoje wrażenia z tego miejsca..."
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
                      <div>
                        <Label>Ocena *</Label>
                        <div className="mt-2">
                          <StarRating
                            rating={pins[currentPinIndex]?.rating || 0}
                            interactive
                            size="lg"
                            onRatingChange={(rating) => updatePin(currentPinIndex, "rating", rating)}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Label>Zdjęcia (Opcjonalne)</Label>
                      <div className="mt-2">
                        {pins[currentPinIndex]?.image_url ? (
                          <div className="relative">
                            <img
                              src={pins[currentPinIndex].image_url}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => updatePin(currentPinIndex, "image_url", "")}
                              className="absolute top-2 right-2 bg-background p-2 rounded-full"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent">
                            <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Dotknij, aby dodać zdjęcia
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Możesz wybrać wiele zdjęć
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, currentPinIndex);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setStep(3)}
                  >
                    Przejdź do podsumowania
                  </Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="space-y-6 pb-80">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-medium">
                  Podsumowanie trasy • {pins.filter(p => p.place_name && p.address).length} {pins.filter(p => p.place_name && p.address).length === 1 ? 'pinezka' : 'pinezki'}
                </h2>
                <p className="text-xl font-semibold">{title}</p>
              </div>

              {/* Map placeholder */}
              <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 bg-primary rounded-full" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white px-4 py-2 flex items-center justify-between text-sm">
                  <span>{pins.filter(p => p.place_name && p.address).length} lokalizacja</span>
                  <span>Podgląd mapy</span>
                </div>
              </div>

              {/* Pins list */}
              {pins.filter(p => p.place_name && p.address).map((pin, index) => (
                <div key={index} className="space-y-3">
                  {pin.image_url && (
                    <div className="relative h-48 bg-muted rounded-lg overflow-hidden">
                      <img src={pin.image_url} alt={pin.place_name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-muted/90 rounded-full flex items-center justify-center">
                          <span className="text-3xl">📍</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {pin.is_transport ? (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Transport: {pin.transport_type}</p>
                          <p className="font-medium">{pin.place_name} → {pin.transport_end}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Pinezka</p>
                            <p className="font-medium">{pin.place_name}</p>
                          </div>
                          <StarRating rating={pin.rating} size="md" />
                        </div>
                      </>
                    )}
                    
                    {pin.tags && pin.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pin.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs text-muted-foreground">Adres</p>
                      <p className="text-sm">{pin.address}</p>
                    </div>
                    
                    {pin.description && (
                      <div>
                        <p className="text-xs text-muted-foreground">Opis:</p>
                        <p className="text-sm whitespace-pre-wrap">{pin.description}</p>
                      </div>
                    )}
                  </div>
                  
                  {index < pins.filter(p => p.place_name && p.address).length - 1 && (
                    <div className="h-px bg-border my-4" />
                  )}
                </div>
              ))}

              {/* Optional route description */}
              <div className="space-y-2">
                <Label htmlFor="route-description">Opis trasy (Opcjonalne)</Label>
                <Textarea
                  id="route-description"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="Podziel się ogólnymi wrażeniami i najważniejszymi..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Opowiedz obserwującym, co sprawiło, że ta trasa była wyjątkowa
                </p>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep(2)}
              >
                + Dodaj kolejną pinezkę
              </Button>
              <Button
                variant="default"
                className="w-full bg-black text-white hover:bg-black/90"
                onClick={() => saveRoute("published")}
                disabled={saving}
              >
                Opublikuj trasę
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => saveRoute("draft")}
                disabled={saving}
              >
                Zapisz jako szkic
              </Button>
              <button
                onClick={() => navigate(-1)}
                className="w-full text-sm text-muted-foreground py-2"
              >
                Anuluj
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateRoute;
