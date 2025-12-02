import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, GripVertical, Plus, Camera, Check, Sparkles, Pencil } from "lucide-react";

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
  const [insertNote, setInsertNote] = useState("");
  const [insertImage, setInsertImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleInsertClick = (index: number) => {
    if (expandedInsertIndex === index) {
      setExpandedInsertIndex(null);
      setInsertNote("");
      setInsertImage(null);
    } else {
      setExpandedInsertIndex(index);
      setInsertNote("");
      setInsertImage(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setInsertImage(event.target?.result as string);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmInsert = () => {
    if (expandedInsertIndex !== null && onAddNote && (insertNote.trim() || insertImage)) {
      onAddNote(expandedInsertIndex, insertNote.trim(), insertImage || undefined);
      setExpandedInsertIndex(null);
      setInsertNote("");
      setInsertImage(null);
    }
  };

  const handleStartEdit = (index: number, note: RouteNote) => {
    setEditingNoteIndex(index);
    setInsertNote(note.text);
    setInsertImage(note.imageUrl || null);
  };

  const handleConfirmEdit = () => {
    if (editingNoteIndex !== null && onAddNote && (insertNote.trim() || insertImage)) {
      onAddNote(editingNoteIndex, insertNote.trim(), insertImage || undefined);
      setEditingNoteIndex(null);
      setInsertNote("");
      setInsertImage(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteIndex(null);
    setInsertNote("");
    setInsertImage(null);
  };

  const filteredPins = pins.filter(p => p.address);

  const getNoteForIndex = (index: number) => {
    return routeNotes.find(n => n.afterPinIndex === index);
  };

  const NoteDisplay = ({ note, index }: { note: RouteNote; index: number }) => {
    const isEditing = editingNoteIndex === index;

    if (isEditing) {
      return (
        <div 
          className="mx-1 my-1.5 border border-primary rounded-lg p-2.5 bg-card space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 items-start">
            <Textarea
              value={insertNote}
              onChange={(e) => setInsertNote(e.target.value)}
              placeholder="Co ciekawego na trasie..."
              className="min-h-[40px] h-10 text-xs resize-none flex-1"
              rows={1}
            />
            <input
              type="file"
              ref={editFileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={() => editFileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          
          {insertImage && (
            <div className="relative h-16 w-24 rounded overflow-hidden">
              <img src={insertImage} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setInsertImage(null)}
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
              onClick={handleCancelEdit}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleConfirmEdit}
              disabled={!insertNote.trim() && !insertImage}
            >
              <Check className="h-3 w-3 mr-1" />
              Zapisz
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-1 my-1.5 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">Ciekawe na trasie</p>
            {note.text && (
              <p className="text-xs text-foreground leading-relaxed">{note.text}</p>
            )}
            {note.imageUrl && (
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

  const InsertButton = ({ afterIndex }: { afterIndex: number }) => {
    const isExpanded = expandedInsertIndex === afterIndex;
    const existingNote = getNoteForIndex(afterIndex);
    
    if (existingNote) {
      return <NoteDisplay note={existingNote} index={afterIndex} />;
    }
    
    // Only show add button if onAddNote is provided
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
          <div 
            className="border border-primary rounded-lg p-2.5 bg-card space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2 items-start">
              <Textarea
                value={insertNote}
                onChange={(e) => setInsertNote(e.target.value)}
                placeholder="Co ciekawego na trasie..."
                className="min-h-[40px] h-10 text-xs resize-none flex-1"
                rows={1}
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
                disabled={uploadingImage}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            
            {insertImage && (
              <div className="relative h-16 w-24 rounded overflow-hidden">
                <img src={insertImage} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setInsertImage(null)}
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
                onClick={() => {
                  setExpandedInsertIndex(null);
                  setInsertNote("");
                  setInsertImage(null);
                }}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={handleConfirmInsert}
                disabled={!insertNote.trim() && !insertImage}
              >
                <Check className="h-3 w-3 mr-1" />
                Dodaj
              </Button>
            </div>
          </div>
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
          <div key={pin.pin_order}>
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
                    className="flex-shrink-0 h-6 w-6"
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
            
            {/* Insert button / note between pins */}
            {showInsertButtons && index < filteredPins.length - 1 && (
              <InsertButton afterIndex={index} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DraggablePinList;