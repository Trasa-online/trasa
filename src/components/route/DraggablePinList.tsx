import { useState, useRef, useCallback, memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, GripVertical, Plus, Camera, Check, Sparkles, Pencil, ImageIcon } from "lucide-react";

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

interface RouteNote {
  afterPinIndex: number;
  text: string;
  imageUrl?: string;
}

interface DraggablePinListProps {
  pins: Pin[];
  onReorder: (pins: Pin[]) => void;
  onPinClick?: (index: number) => void;
  onPinRemove?: (index: number) => void;
  routeNotes?: RouteNote[];
  onAddNote?: (afterIndex: number, note: string, imageUrl?: string) => void;
  onRemoveNote?: (afterIndex: number) => void;
  showRemoveButton?: boolean;
  showInsertButtons?: boolean;
  compact?: boolean;
}

interface NoteFormProps {
  value: string;
  onChange: (value: string) => void;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  uploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const NoteForm = memo(({ 
  value, 
  onChange, 
  imageUrl, 
  onImageChange, 
  onConfirm, 
  onCancel, 
  confirmLabel,
  uploading,
  onImageUpload
}: NoteFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div 
      className="border border-primary rounded-lg p-2.5 bg-card space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2 items-start">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Co ciekawego na trasie..."
          className="min-h-[40px] h-10 text-xs resize-none flex-1"
          rows={1}
          autoFocus
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={onImageUpload}
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
      
      {imageUrl && (
        <div className="relative h-16 w-24 rounded overflow-hidden">
          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onImageChange(null)}
            className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      
      <div className="flex gap-1.5 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Anuluj
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={onConfirm}
          disabled={!value.trim() && !imageUrl}
        >
          <Check className="h-3 w-3 mr-1" />
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
});

NoteForm.displayName = "NoteForm";

const DraggablePinList = ({
  pins,
  onReorder,
  onPinClick,
  onPinRemove,
  routeNotes = [],
  onAddNote,
  onRemoveNote,
  showRemoveButton = true,
  showInsertButtons = false,
  compact = false,
}: DraggablePinListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedInsertIndex, setExpandedInsertIndex] = useState<number | null>(null);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [expandedNoteImages, setExpandedNoteImages] = useState<Set<number>>(new Set());
  const [insertNote, setInsertNote] = useState("");
  const [insertImage, setInsertImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const toggleNoteImage = useCallback((index: number) => {
    setExpandedNoteImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newPins = [...pins];
    const [draggedPin] = newPins.splice(draggedIndex, 1);
    newPins.splice(dropIndex, 0, draggedPin);
    
    const reorderedPins = newPins.map((pin, idx) => ({
      ...pin,
      pin_order: idx,
    }));

    onReorder(reorderedPins);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleInsertClick = useCallback((index: number) => {
    setExpandedInsertIndex(prev => {
      if (prev === index) {
        setInsertNote("");
        setInsertImage(null);
        return null;
      } else {
        setInsertNote("");
        setInsertImage(null);
        return index;
      }
    });
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setInsertImage(event.target?.result as string);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleConfirmInsert = useCallback(() => {
    if (expandedInsertIndex !== null && onAddNote && (insertNote.trim() || insertImage)) {
      onAddNote(expandedInsertIndex, insertNote.trim(), insertImage || undefined);
      setExpandedInsertIndex(null);
      setInsertNote("");
      setInsertImage(null);
    }
  }, [expandedInsertIndex, onAddNote, insertNote, insertImage]);

  const handleStartEdit = useCallback((index: number, note: RouteNote) => {
    setEditingNoteIndex(index);
    setInsertNote(note.text);
    setInsertImage(note.imageUrl || null);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (editingNoteIndex !== null && onAddNote && (insertNote.trim() || insertImage)) {
      onAddNote(editingNoteIndex, insertNote.trim(), insertImage || undefined);
      setEditingNoteIndex(null);
      setInsertNote("");
      setInsertImage(null);
    }
  }, [editingNoteIndex, onAddNote, insertNote, insertImage]);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteIndex(null);
    setInsertNote("");
    setInsertImage(null);
  }, []);

  const handleCancelInsert = useCallback(() => {
    setExpandedInsertIndex(null);
    setInsertNote("");
    setInsertImage(null);
  }, []);

  const filteredPins = pins.filter(p => p.address);

  const getNoteForIndex = useCallback((index: number) => {
    return routeNotes.find(n => n.afterPinIndex === index);
  }, [routeNotes]);

  const renderNoteDisplay = (note: RouteNote, index: number) => {
    const isEditing = editingNoteIndex === index;

    if (isEditing) {
      return (
        <div className="mx-1 my-1.5" onClick={(e) => e.stopPropagation()}>
          <NoteForm
            value={insertNote}
            onChange={setInsertNote}
            imageUrl={insertImage}
            onImageChange={setInsertImage}
            onConfirm={handleConfirmEdit}
            onCancel={handleCancelEdit}
            confirmLabel="Zapisz"
            uploading={uploadingImage}
            onImageUpload={handleImageUpload}
          />
        </div>
      );
    }

    const isImageExpanded = expandedNoteImages.has(index);

    return (
      <div className="mx-1 my-1.5 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Ciekawe na trasie</p>
              {note.imageUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNoteImage(index);
                  }}
                  className="flex items-center gap-0.5 text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <ImageIcon className="h-3 w-3" />
                  <span>{isImageExpanded ? 'ukryj' : 'pokaż'}</span>
                </button>
              )}
            </div>
            {note.text && (
              <p className="text-xs text-foreground leading-relaxed mt-0.5">{note.text}</p>
            )}
            {note.imageUrl && isImageExpanded && (
              <div className="mt-2 relative h-20 w-28 rounded-lg overflow-hidden ring-1 ring-border">
                <img src={note.imageUrl} alt="Notatka" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {onAddNote && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(index, note);
                }}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onRemoveNote && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveNote(index);
                }}
                className="text-muted-foreground hover:text-destructive p-1 hover:bg-muted rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderInsertButton = (afterIndex: number) => {
    const isExpanded = expandedInsertIndex === afterIndex;
    const existingNote = getNoteForIndex(afterIndex);
    
    if (existingNote) {
      return renderNoteDisplay(existingNote, afterIndex);
    }
    
    if (!onAddNote) {
      return null;
    }
    
    return (
      <div className="relative my-1">
        {!isExpanded ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleInsertClick(afterIndex);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded border border-dashed border-muted-foreground/30 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>ciekawe na trasie</span>
          </button>
        ) : (
          <NoteForm
            value={insertNote}
            onChange={setInsertNote}
            imageUrl={insertImage}
            onImageChange={setInsertImage}
            onConfirm={handleConfirmInsert}
            onCancel={handleCancelInsert}
            confirmLabel="Dodaj"
            uploading={uploadingImage}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {filteredPins.map((pin, index) => {
        const actualIndex = pins.findIndex(p => p.pin_order === pin.pin_order);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;

        return (
          <div key={`pin-${pin.pin_order}`}>
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`border border-border rounded-lg p-2.5 bg-card transition-all ${
                isDragging ? 'opacity-50 scale-[0.98]' : ''
              } ${isDragOver ? 'border-primary border-2' : ''} ${
                onPinClick ? 'cursor-pointer hover:border-primary' : ''
              }`}
              onClick={() => onPinClick?.(actualIndex)}
            >
              <div className="flex items-start gap-2">
                <div 
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                </div>

                <div className={`flex-shrink-0 ${compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'} rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium`}>
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{pin.place_name || pin.address}</p>
                    {pin.rating > 0 && (
                      <div className="flex items-center gap-0.5 text-xs flex-shrink-0">
                        <span className="text-yellow-500">★</span>
                        <span>{pin.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {pin.place_name && pin.address && pin.address !== pin.place_name && (
                    <p className="text-[11px] text-muted-foreground truncate">{pin.address}</p>
                  )}
                  
                  {pin.tags && pin.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pin.tags.slice(0, compact ? 3 : 4).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          {tag}
                        </Badge>
                      ))}
                      {pin.tags.length > (compact ? 3 : 4) && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          +{pin.tags.length - (compact ? 3 : 4)}
                        </Badge>
                      )}
                    </div>
                  )}

                  {!compact && pin.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{pin.description}</p>
                  )}

                  {!compact && pin.image_url && (
                    <div className="relative h-24 bg-muted rounded overflow-hidden mt-1.5">
                      <img src={pin.image_url} alt={pin.place_name} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {showRemoveButton && onPinRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinRemove(actualIndex);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {showInsertButtons && index < filteredPins.length - 1 && renderInsertButton(index)}
          </div>
        );
      })}
    </div>
  );
};

export default DraggablePinList;
