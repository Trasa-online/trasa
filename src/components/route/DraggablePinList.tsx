import { useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, GripVertical, Plus, Camera, Check, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { NoteType, NOTE_TYPES, NOTE_TYPE_KEYS, getNoteTypeConfig } from "@/lib/noteTypes";
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
  mentioned_users?: string[];
  latitude?: number;
  longitude?: number;
  notes: PinNote[];
  expectation_met: "yes" | "average" | "no" | null;
  pros: string[];
  cons: string[];
  trip_role: "must_see" | "nice_addition" | "skippable" | null;
  one_liner: string;
  recommended_for: string[];
}

interface DraggablePinListProps {
  pins: Pin[];
  onReorder: (pins: Pin[]) => void;
  onPinClick?: (index: number) => void;
  onPinRemove?: (index: number) => void;
  onPinNotesChange?: (pinIndex: number, notes: PinNote[]) => void;
  onPinNameChange?: (pinIndex: number, name: string) => void;
  showRemoveButton?: boolean;
  showNotesEditor?: boolean;
  showNameEditor?: boolean;
  compact?: boolean;
}

const MAX_NOTES_PER_PIN = 3;

const DraggablePinList = ({
  pins,
  onReorder,
  onPinClick,
  onPinRemove,
  onPinNotesChange,
  onPinNameChange,
  showRemoveButton = true,
  showNotesEditor = false,
  showNameEditor = false,
  compact = false,
}: DraggablePinListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedNotePinIndex, setExpandedNotePinIndex] = useState<number | null>(null);
  const [editingNoteInfo, setEditingNoteInfo] = useState<{ pinIndex: number; noteIndex: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [addingNoteToPinIndex, setAddingNoteToPinIndex] = useState<number | null>(null);
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>('fact');
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
    setExpandedNotePinIndex(pinIndex);
    setEditingNoteInfo(null);
    setNoteText("");
    setNoteImage(null);
    setSelectedNoteType('fact');
  };

  const startEditingNote = (pinIndex: number, noteIndex: number, note: PinNote) => {
    setEditingNoteInfo({ pinIndex, noteIndex });
    setAddingNoteToPinIndex(null);
    setNoteText(note.text);
    setNoteImage(note.imageUrl || null);
    setSelectedNoteType(note.note_type || 'fact');
  };

  const cancelNoteEdit = () => {
    setAddingNoteToPinIndex(null);
    setEditingNoteInfo(null);
    setNoteText("");
    setNoteImage(null);
    setSelectedNoteType('fact');
  };

  const confirmAddNote = (pinIndex: number) => {
    if (!onPinNotesChange || (!noteText.trim() && !noteImage)) return;
    
    const pin = pins.find((_, i) => i === pinIndex);
    if (!pin) return;
    
    const newNote: PinNote = {
      text: noteText.trim(),
      imageUrl: noteImage || undefined,
      note_order: pin.notes?.length || 0,
      note_type: selectedNoteType,
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
      note_type: selectedNoteType,
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

  const renderNoteForm = (pinIndex: number, isEditing: boolean) => {
    const currentConfig = getNoteTypeConfig(selectedNoteType);
    const CurrentIcon = currentConfig.icon;
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <CurrentIcon className={`h-4 w-4 ${currentConfig.iconColor}`} />
            <span className="text-xs font-medium">
              {isEditing ? "Edytuj notatkę" : "Dodaj notatkę"}
            </span>
          </div>
        </div>

        {/* Note Type Selector */}
        <div className="flex flex-wrap gap-1.5">
          {NOTE_TYPE_KEYS.map((typeKey) => {
            const config = NOTE_TYPES[typeKey];
            const Icon = config.icon;
            const isActive = selectedNoteType === typeKey;
            
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedNoteType(typeKey)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
                  isActive 
                    ? `${config.activeBg} ${config.activeBorder} ${config.labelColor}` 
                    : `bg-background border-border text-muted-foreground ${config.hoverBg} ${config.hoverBorder}`
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? config.iconColor : ''}`} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
        
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Opisz to miejsce lub trasę..."
          className="min-h-[60px] text-sm resize-none"
          autoFocus
        />
        
        <div className="flex items-center gap-2">
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
            size="sm"
            className="h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Dodaj zdjęcie
          </Button>
          
          {noteImage && (
            <div className="relative h-10 w-14 rounded overflow-hidden ring-1 ring-border">
              <img src={noteImage} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setNoteImage(null)}
                className="absolute top-0 right-0 bg-background/80 rounded-bl p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 justify-end pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={cancelNoteEdit}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={() => isEditing ? confirmEditNote() : confirmAddNote(pinIndex)}
            disabled={!noteText.trim() && !noteImage}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            {isEditing ? "Zapisz" : "Dodaj"}
          </Button>
        </div>
      </div>
    );
  };

  const renderNoteDisplay = (note: PinNote, pinIndex: number, noteIndex: number) => {
    const isEditing = editingNoteInfo?.pinIndex === pinIndex && editingNoteInfo?.noteIndex === noteIndex;
    
    if (isEditing) {
      return <div key={noteIndex}>{renderNoteForm(pinIndex, true)}</div>;
    }

    const noteConfig = getNoteTypeConfig(note.note_type);
    const NoteIcon = noteConfig.icon;

    return (
      <div 
        key={noteIndex}
        className={`flex items-start gap-2 p-2.5 rounded-lg border ${noteConfig.bgColor} ${noteConfig.borderColor}`}
      >
        <NoteIcon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${noteConfig.iconColor}`} />
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-medium ${noteConfig.labelColor}`}>{noteConfig.label}</span>
          {note.text && (
            <p className="text-xs text-foreground leading-relaxed mt-0.5">{note.text}</p>
          )}
          {note.imageUrl && (
            <div className="mt-2 relative h-16 w-24 rounded overflow-hidden ring-1 ring-border">
              <img src={note.imageUrl} alt="Notatka" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        {onPinNotesChange && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => startEditingNote(pinIndex, noteIndex, note)}
              className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeNote(pinIndex, noteIndex)}
              className="text-muted-foreground hover:text-destructive p-1 hover:bg-muted rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBetweenPinsSection = (pinIndex: number, isLastPin: boolean) => {
    if (!showNotesEditor || isLastPin) return null;
    
    const pin = pins[pinIndex];
    const pinNotes = pin?.notes || [];
    const isExpanded = expandedNotePinIndex === pinIndex;
    const isAddingNote = addingNoteToPinIndex === pinIndex;
    const canAddMoreNotes = pinNotes.length < MAX_NOTES_PER_PIN;
    const hasNotes = pinNotes.length > 0;

    return (
      <div className="py-1">
        {/* Notes exist - show collapsed/expanded view */}
        {hasNotes && !isExpanded && (
          <button
            type="button"
            onClick={() => setExpandedNotePinIndex(pinIndex)}
            className="w-full flex items-center gap-2 py-2.5 px-3 text-xs bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <div className="flex -space-x-1">
              {pinNotes.slice(0, 3).map((note, i) => {
                const config = getNoteTypeConfig(note.note_type);
                const Icon = config.icon;
                return <Icon key={i} className={`h-3.5 w-3.5 ${config.iconColor}`} />;
              })}
            </div>
            <span className="text-foreground font-medium">
              {pinNotes.length} notat{pinNotes.length === 1 ? 'ka' : pinNotes.length < 5 ? 'ki' : 'ek'} na trasie
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          </button>
        )}

        {/* Expanded notes view */}
        {hasNotes && isExpanded && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setExpandedNotePinIndex(null);
                cancelNoteEdit();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Zwiń ciekawostki</span>
            </button>
            
            {pinNotes.map((note, noteIndex) => renderNoteDisplay(note, pinIndex, noteIndex))}
            
            {isAddingNote ? (
              renderNoteForm(pinIndex, false)
            ) : canAddMoreNotes && onPinNotesChange && (
              <button
                type="button"
                onClick={() => startAddingNote(pinIndex)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/50 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Dodaj ciekawostkę ({pinNotes.length}/{MAX_NOTES_PER_PIN})</span>
              </button>
            )}
          </div>
        )}

        {/* No notes - show add button */}
        {!hasNotes && !isAddingNote && onPinNotesChange && (
          <button
            type="button"
            onClick={() => startAddingNote(pinIndex)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/50 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Dodaj notatkę na trasie</span>
          </button>
        )}

        {/* Adding note form when no existing notes */}
        {!hasNotes && isAddingNote && renderNoteForm(pinIndex, false)}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      {filteredPins.map((pin, index) => {
        const actualIndex = pins.findIndex(p => p.pin_order === pin.pin_order);
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;
        const isLastPin = index === filteredPins.length - 1;

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
                    {showNameEditor && editingNameIndex === actualIndex ? (
                      <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onPinNameChange?.(actualIndex, editingNameValue);
                              setEditingNameIndex(null);
                            } else if (e.key === 'Escape') {
                              setEditingNameIndex(null);
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => {
                            onPinNameChange?.(actualIndex, editingNameValue);
                            setEditingNameIndex(null);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => setEditingNameIndex(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{pin.place_name || pin.address}</p>
                        {showNameEditor && onPinNameChange && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNameIndex(actualIndex);
                              setEditingNameValue(pin.place_name || pin.address);
                            }}
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
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

                  {/* Show notes count indicator when NOT in editor mode */}
                  {!showNotesEditor && pin.notes && pin.notes.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <div className="flex -space-x-0.5">
                        {pin.notes.slice(0, 3).map((note, i) => {
                          const config = getNoteTypeConfig(note.note_type);
                          const Icon = config.icon;
                          return <Icon key={i} className={`h-3 w-3 ${config.iconColor}`} />;
                        })}
                      </div>
                      <span>{pin.notes.length} notat{pin.notes.length === 1 ? 'ka' : pin.notes.length < 5 ? 'ki' : 'ek'}</span>
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

            {/* Between pins section for adding notes */}
            {renderBetweenPinsSection(index, isLastPin)}
          </div>
        );
      })}
    </div>
  );
};

export default DraggablePinList;
