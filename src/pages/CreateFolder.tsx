import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useFolders";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Load existing folder data when editing
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
      toast({ variant: "destructive", title: "Nazwa folderu jest wymagana" });
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
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-4 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold">{id ? "Edytuj folder" : "Nowy folder"}</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Cover image */}
        <div className="space-y-2">
          <Label>Okładka (opcjonalna)</Label>
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
        <div className="space-y-2">
          <Label htmlFor="folder-name">Nazwa folderu *</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. JAPONIA"
            maxLength={50}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="folder-desc">Opis (opcjonalny)</Label>
          <Textarea
            id="folder-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="np. 2 tygodnie w Kraju Kwitnącej Wiśni..."
            rows={3}
            maxLength={300}
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {id ? "Zapisz zmiany" : "Utwórz folder"}
        </Button>
      </div>
    </div>
  );
};

export default CreateFolder;
