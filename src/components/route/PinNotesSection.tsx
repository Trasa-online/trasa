import { useState, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Camera, Check, Sparkles, Pencil, Plus, ImageIcon } from "lucide-react";

interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
}

interface PinNotesSectionProps {
  notes: PinNote[];
  onNotesChange: (notes: PinNote[]) => void;
  maxNotes?: number;
  onImageUpload: (file: File) => Promise<string | null>;
}

const MAX_NOTES = 3;

const PinNotesSection = ({
  notes,
  onNotesChange,
  maxNotes = MAX_NOTES,
  onImageUpload,
}: PinNotesSectionProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUploadInternal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // First show preview as base64
      const reader = new FileReader();
      reader.onload = (event) => {
        setNoteImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = () => {
    if (!noteText.trim() && !noteImage) return;
    
    const newNote: PinNote = {
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
      note_order: notes.length,
    };
    
    onNotesChange([...notes, newNote]);
    setNoteText("");
    setNoteImage(null);
    setAddingNew(false);
  };

  const handleEditNote = (index: number) => {
    if (!noteText.trim() && !noteImage) return;
    
    const updatedNotes = [...notes];
    updatedNotes[index] = {
      ...updatedNotes[index],
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
    };
    
    onNotesChange(updatedNotes);
    setNoteText("");
    setNoteImage(null);
    setEditingIndex(null);
  };

  const handleRemoveNote = (index: number) => {
    const updatedNotes = notes
      .filter((_, i) => i !== index)
      .map((note, i) => ({ ...note, note_order: i }));
    onNotesChange(updatedNotes);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setNoteText(notes[index].text);
    setNoteImage(notes[index].imageUrl || null);
    setAddingNew(false);
  };

  const startAdding = () => {
    setAddingNew(true);
    setEditingIndex(null);
    setNoteText("");
    setNoteImage(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setAddingNew(false);
    setNoteText("");
    setNoteImage(null);
  };

  const canAddMore = notes.length < maxNotes;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Ciekawe na trasie ({notes.length}/{maxNotes})
        </Label>
      </div>

      {/* Existing notes */}
      {notes.map((note, index) => (
        editingIndex === index ? (
          <div key={index} className="border border-primary rounded-lg p-3 bg-card space-y-2">
            <div className="flex gap-2 items-start">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Co ciekawego na trasie..."
                className="min-h-[60px] text-sm resize-none flex-1"
                rows={2}
                autoFocus
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUploadInternal}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            
            {noteImage && (
              <div className="relative h-20 w-32 rounded overflow-hidden">
                <img src={noteImage} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setNoteImage(null)}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelEdit}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleEditNote(index)}
                disabled={!noteText.trim() && !noteImage}
              >
                <Check className="h-3 w-3 mr-1" />
                Zapisz
              </Button>
            </div>
          </div>
        ) : (
          <div 
            key={index} 
            className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {note.text && (
                  <p className="text-sm text-foreground leading-relaxed">{note.text}</p>
                )}
                {note.imageUrl && (
                  <div className="mt-2 relative h-20 w-32 rounded-lg overflow-hidden ring-1 ring-border">
                    <img src={note.imageUrl} alt="Notatka" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEditing(index)}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveNote(index)}
                  className="text-muted-foreground hover:text-destructive p-1.5 hover:bg-muted rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )
      ))}

      {/* Add new note form */}
      {addingNew && (
        <div className="border border-primary rounded-lg p-3 bg-card space-y-2">
          <div className="flex gap-2 items-start">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Co ciekawego na trasie..."
              className="min-h-[60px] text-sm resize-none flex-1"
              rows={2}
              autoFocus
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUploadInternal}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          
          {noteImage && (
            <div className="relative h-20 w-32 rounded overflow-hidden">
              <img src={noteImage} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setNoteImage(null)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddNote}
              disabled={!noteText.trim() && !noteImage}
            >
              <Check className="h-3 w-3 mr-1" />
              Dodaj
            </Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!addingNew && editingIndex === null && canAddMore && (
        <button
          type="button"
          onClick={startAdding}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded border border-dashed border-muted-foreground/30 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Dodaj ciekawostkę</span>
        </button>
      )}

      {notes.length === 0 && !addingNew && (
        <p className="text-xs text-muted-foreground">
          Dodaj do 3 ciekawych informacji o tym miejscu
        </p>
      )}
    </div>
  );
};

export default PinNotesSection;
