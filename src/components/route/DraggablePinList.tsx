import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, GripVertical, Sparkles, Plus, Camera, Check, Pencil, ImageIcon } from "lucide-react";

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
  mentioned_users: string[];
  latitude?: number;
  longitude?: number;
  notes: PinNote[];
}

interface DraggablePinListProps {
  pins: Pin[];
  onReorder: (pins: Pin[]) => void;
  onPinClick?: (index: number) => void;
  onPinRemove?: (index: number) => void;
  onPinNotesChange?: (pinIndex: number, notes: PinNote[]) => void;
  showRemoveButton?: boolean;
  showNotesEditor?: boolean;
  compact?: boolean;
}

const MAX_NOTES_PER_PIN = 3;

const DraggablePinList = ({
  pins,
  onReorder,
  onPinClick,
  onPinRemove,
  onPinNotesChange,
  showRemoveButton = true,
  showNotesEditor = false,
  compact = false,
}: DraggablePinListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedNotePinIndex, setExpandedNotePinIndex] = useState<number | null>(null);
  const [editingNoteInfo, setEditingNoteInfo] = useState<{ pinIndex: number; noteIndex: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [addingNoteToPinIndex, setAddingNoteToPinIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setNoteImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const startAddingNote = (pinIndex: number) => {
    setAddingNoteToPinIndex(pinIndex);
    setEditingNoteInfo(null);
    setNoteText("");
    setNoteImage(null);
  };

  const startEditingNote = (pinIndex: number, noteIndex: number, note: PinNote) => {
    setEditingNoteInfo({ pinIndex, noteIndex });
    setAddingNoteToPinIndex(null);
    setNoteText(note.text);
    setNoteImage(note.imageUrl || null);
  };

  const cancelNoteEdit = () => {
    setAddingNoteToPinIndex(null);
    setEditingNoteInfo(null);
    setNoteText("");
    setNoteImage(null);
  };

  const confirmAddNote = (pinIndex: number) => {
    if (!onPinNotesChange || (!noteText.trim() && !noteImage)) return;
    
    const pin = pins.find((_, i) => i === pinIndex);
    if (!pin) return;
    
    const newNote: PinNote = {
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
      note_order: pin.notes?.length || 0,
    };
    
    onPinNotesChange(pinIndex, [...(pin.notes || []), newNote]);
    cancelNoteEdit();
  };

  const confirmEditNote = () => {
    if (!onPinNotesChange || !editingNoteInfo || (!noteText.trim() && !noteImage)) return;
    
    const { pinIndex, noteIndex } = editingNoteInfo;
    const pin = pins[pinIndex];
    if (!pin) return;
    
    const updatedNotes = [...(pin.notes || [])];
    updatedNotes[noteIndex] = {
      ...updatedNotes[noteIndex],
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
    };
    
    onPinNotesChange(pinIndex, updatedNotes);
    cancelNoteEdit();
  };

  const removeNote = (pinIndex: number, noteIndex: number) => {
    if (!onPinNotesChange) return;
    
    const pin = pins[pinIndex];
    if (!pin) return;
    
    const updatedNotes = (pin.notes || [])
      .filter((_, i) => i !== noteIndex)
      .map((note, i) => ({ ...note, note_order: i }));
    
    onPinNotesChange(pinIndex, updatedNotes);
  };

  const filteredPins = pins.filter(p => p.address);

  const renderNoteForm = (pinIndex: number, isEditing: boolean) => (
    <div 
      className="mt-2 border border-primary rounded-lg p-2.5 bg-card space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2 items-start">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Co ciekawego na trasie..."
          className="min-h-[40px] h-10 text-xs resize-none flex-1"
          rows={1}
          autoFocus
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>
      
      {noteImage && (
        <div className="relative h-16 w-24 rounded overflow-hidden">
          <img src={noteImage} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => setNoteImage(null)}
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
          onClick={cancelNoteEdit}
        >
          Anuluj
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={() => isEditing ? confirmEditNote() : confirmAddNote(pinIndex)}
          disabled={!noteText.trim() && !noteImage}
        >
          <Check className="h-3 w-3 mr-1" />
          {isEditing ? "Zapisz" : "Dodaj"}
        </Button>
      </div>
    </div>
  );

  const renderNoteDisplay = (note: PinNote, pinIndex: number, noteIndex: number) => {
    const isEditing = editingNoteInfo?.pinIndex === pinIndex && editingNoteInfo?.noteIndex === noteIndex;
    
    if (isEditing) {
      return renderNoteForm(pinIndex, true);
    }

    return (
      <div 
        key={noteIndex}
        className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {note.text && (
              <p className="text-[11px] text-foreground leading-relaxed">{note.text}</p>
            )}
            {note.imageUrl && (
              <div className="mt-1.5 relative h-12 w-20 rounded overflow-hidden ring-1 ring-border">
                <img src={note.imageUrl} alt="Notatka" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
          {onPinNotesChange && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => startEditingNote(pinIndex, noteIndex, note)}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removeNote(pinIndex, noteIndex)}
                className="text-muted-foreground hover:text-destructive p-1 hover:bg-muted rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {filteredPins.map((pin, index) => {
        const actualIndex = pins.findIndex(p => p.pin_order === pin.pin_order);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;
        const isExpanded = expandedNotePinIndex === index;
        const pinNotes = pin.notes || [];
        const canAddMoreNotes = pinNotes.length < MAX_NOTES_PER_PIN;
        const isAddingNote = addingNoteToPinIndex === index;

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

                  {/* Notes indicator/toggle when showNotesEditor is true */}
                  {showNotesEditor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedNotePinIndex(isExpanded ? null : index);
                        cancelNoteEdit();
                      }}
                      className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 mt-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>
                        {pinNotes.length > 0 
                          ? `${pinNotes.length} ciekawostk${pinNotes.length === 1 ? 'a' : pinNotes.length < 5 ? 'i' : 'ek'}` 
                          : 'Dodaj ciekawostkę'
                        }
                      </span>
                      {pinNotes.length > 0 && (
                        <span className="text-muted-foreground">
                          ({isExpanded ? 'zwiń' : 'rozwiń'})
                        </span>
                      )}
                    </button>
                  )}

                  {/* Show notes count indicator when NOT in editor mode */}
                  {!showNotesEditor && pinNotes.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                      <Sparkles className="h-3 w-3" />
                      <span>{pinNotes.length} ciekawostk{pinNotes.length === 1 ? 'a' : pinNotes.length < 5 ? 'i' : 'ek'}</span>
                    </div>
                  )}

                  {/* Expanded notes section */}
                  {showNotesEditor && isExpanded && (
                    <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      {pinNotes.map((note, noteIndex) => renderNoteDisplay(note, index, noteIndex))}
                      
                      {isAddingNote ? (
                        renderNoteForm(index, false)
                      ) : canAddMoreNotes && onPinNotesChange && (
                        <button
                          type="button"
                          onClick={() => startAddingNote(index)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded border border-dashed border-muted-foreground/30 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Dodaj ciekawostkę ({pinNotes.length}/{MAX_NOTES_PER_PIN})</span>
                        </button>
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
          </div>
        );
      })}
    </div>
  );
};

export default DraggablePinList;
