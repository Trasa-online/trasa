import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Camera, Check, Pencil, Plus, NotebookPen } from "lucide-react";
import { NOTE_TYPES, NoteType, getNoteTypeConfig, NOTE_TYPE_KEYS } from "@/lib/noteTypes";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PinNote {
  id?: string;
  text: string;
  imageUrl?: string;
  note_order: number;
  note_type: NoteType;
}

interface PinNotesSectionProps {
  notes: PinNote[];
  onNotesChange: (notes: PinNote[]) => void;
  maxNotes?: number;
  onImageUpload: (file: File) => Promise<string | null>;
}

const MAX_NOTES = 3;

// Note Type Selector Component
const NoteTypeSelector = ({ 
  value, 
  onChange 
}: { 
  value: NoteType; 
  onChange: (type: NoteType) => void;
}) => {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-1 mb-2">
        {NOTE_TYPE_KEYS.map((key) => {
          const config = NOTE_TYPES[key];
          const Icon = config.icon;
          const isActive = value === key;
          
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(key)}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-md border transition-all",
                    isActive 
                      ? cn(config.activeBg, config.activeBorder, config.iconColor)
                      : cn("bg-muted/50 border-muted-foreground/20 text-muted-foreground", config.hoverBg, config.hoverBorder)
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {config.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

// Single Note Display Component
const NoteDisplay = ({
  note,
  index,
  onEdit,
  onRemove,
}: {
  note: PinNote;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) => {
  const config = getNoteTypeConfig(note.note_type);
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "p-3 border rounded-lg",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-[10px] font-medium mb-0.5", config.labelColor)}>
            {config.label}
          </p>
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
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive p-1.5 hover:bg-muted rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Note Edit Form Component
const NoteEditForm = ({
  noteText,
  setNoteText,
  noteImage,
  setNoteImage,
  noteType,
  setNoteType,
  onSave,
  onCancel,
  saveLabel,
  fileInputRef,
  uploading,
  onFileChange,
}: {
  noteText: string;
  setNoteText: (text: string) => void;
  noteImage: string | null;
  setNoteImage: (image: string | null) => void;
  noteType: NoteType;
  setNoteType: (type: NoteType) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const canSave = noteText.trim() || noteImage;

  return (
    <div className="border border-primary rounded-lg p-3 bg-card space-y-2">
      <NoteTypeSelector value={noteType} onChange={setNoteType} />
      
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
          onChange={onFileChange}
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
          onClick={onCancel}
        >
          Anuluj
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!canSave}
        >
          <Check className="h-3 w-3 mr-1" />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
};

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
  const [noteType, setNoteType] = useState<NoteType>("fact");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUploadInternal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
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
      note_type: noteType,
    };
    
    onNotesChange([...notes, newNote]);
    resetForm();
  };

  const handleEditNote = (index: number) => {
    if (!noteText.trim() && !noteImage) return;
    
    const updatedNotes = [...notes];
    updatedNotes[index] = {
      ...updatedNotes[index],
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
      note_type: noteType,
    };
    
    onNotesChange(updatedNotes);
    resetForm();
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
    setNoteType(notes[index].note_type || 'fact');
    setAddingNew(false);
  };

  const startAdding = () => {
    setAddingNew(true);
    setEditingIndex(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingIndex(null);
    setAddingNew(false);
    setNoteText("");
    setNoteImage(null);
    setNoteType("fact");
  };

  const canAddMore = notes.length < maxNotes;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-1.5">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          Notatki na trasie ({notes.length}/{maxNotes})
        </Label>
      </div>

      {/* Existing notes */}
      {notes.map((note, index) => (
        editingIndex === index ? (
          <NoteEditForm
            key={index}
            noteText={noteText}
            setNoteText={setNoteText}
            noteImage={noteImage}
            setNoteImage={setNoteImage}
            noteType={noteType}
            setNoteType={setNoteType}
            onSave={() => handleEditNote(index)}
            onCancel={resetForm}
            saveLabel="Zapisz"
            fileInputRef={fileInputRef}
            uploading={uploading}
            onFileChange={handleImageUploadInternal}
          />
        ) : (
          <NoteDisplay
            key={index}
            note={note}
            index={index}
            onEdit={() => startEditing(index)}
            onRemove={() => handleRemoveNote(index)}
          />
        )
      ))}

      {/* Add new note form */}
      {addingNew && (
        <NoteEditForm
          noteText={noteText}
          setNoteText={setNoteText}
          noteImage={noteImage}
          setNoteImage={setNoteImage}
          noteType={noteType}
          setNoteType={setNoteType}
          onSave={handleAddNote}
          onCancel={resetForm}
          saveLabel="Dodaj"
          fileInputRef={fileInputRef}
          uploading={uploading}
          onFileChange={handleImageUploadInternal}
        />
      )}

      {/* Add button */}
      {!addingNew && editingIndex === null && canAddMore && (
        <button
          type="button"
          onClick={startAdding}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Dodaj notatkę</span>
        </button>
      )}

      {notes.length === 0 && !addingNew && (
        <p className="text-xs text-muted-foreground">
          Dodaj do 3 notatek o tym miejscu (ciekawostki, doświadczenia, rady, ostrzeżenia)
        </p>
      )}
    </div>
  );
};

export default PinNotesSection;
