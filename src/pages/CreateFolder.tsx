import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useFolders";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";

const CreateFolder = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createFolder, updateFolder } = useFolders();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingFolder } = useQuery({
    queryKey: ["folder-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_folders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (existingFolder) {
      setName(existingFolder.name);
      setDescription(existingFolder.description || "");
      setCoverUrl(existingFolder.cover_image_url || "");
    }
  }, [existingFolder]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 1200, 800, 0.8);
      const fileName = `${user.id}/folder-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("route-images")
        .upload(fileName, compressed, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("route-images")
        .getPublicUrl(fileName);

      setCoverUrl(publicUrl);
    } catch (error) {
      toast({ variant: "destructive", title: "Błąd przesyłania zdjęcia" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Nazwa podróży jest wymagana" });
      return;
    }

    setSaving(true);
    try {
      if (id) {
        await updateFolder.mutateAsync({
          id,
          name: name.trim(),
          description: description.trim() || undefined,
          cover_image_url: coverUrl || undefined,
        });
        navigate(`/folder/${id}`);
      } else {
        const result = await createFolder.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          cover_image_url: coverUrl || undefined,
        });
        navigate(`/folder/${result.id}`);
      }
    } catch {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-medium">{id ? "Edytuj podróż" : "Nowa podróż"}</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Cover image */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">
            Okładka (opcjonalna)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
          {coverUrl ? (
            <div className="relative">
              <img src={coverUrl} alt="Okładka" className="w-full h-40 object-cover rounded-xl ring-1 ring-border" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                Zmień
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Camera className="h-6 w-6" />
                  <span className="text-sm">Dodaj okładkę</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">
            Nazwa podróży <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Japonia – 2 tygodnie"
            maxLength={50}
            className="text-base border-muted-foreground/20 focus:border-foreground"
          />
          <p className="text-[11px] text-muted-foreground">{name.length}/50 znaków</p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase block">
            Opis (opcjonalny)
          </label>
          <Textarea
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= 300) setDescription(e.target.value);
            }}
            placeholder="Opisz swoją podróż w kilku zdaniach..."
            rows={3}
            className="resize-none text-sm border-muted-foreground/20 focus:border-foreground"
            maxLength={300}
          />
          <p className={`text-[10px] font-medium transition-colors ${
            description.length >= 300 ? "text-destructive" : "text-muted-foreground"
          }`}>
            {description.length}/300
          </p>
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {id ? "Zapisz zmiany" : "Utwórz podróż"}
        </Button>
      </div>
    </div>
  );
};

export default CreateFolder;
