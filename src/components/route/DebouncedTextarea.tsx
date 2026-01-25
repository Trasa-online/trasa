import { useState, useEffect, useRef, memo } from "react";
import { Textarea } from "@/components/ui/textarea";

interface DebouncedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  maxWords?: number;
  debounceMs?: number;
}

/**
 * A textarea component that debounces state updates to prevent excessive re-renders.
 * Uses local state for immediate UI feedback, syncs to parent after delay.
 */
const DebouncedTextarea = memo(function DebouncedTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "resize-none",
  maxWords = 150,
  debounceMs = 500,
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExternalUpdate = useRef(false);

  // Sync from parent when value changes externally (e.g., switching pins)
  useEffect(() => {
    if (value !== localValue) {
      isExternalUpdate.current = true;
      setLocalValue(value);
    }
  }, [value]);

  // Debounced sync to parent
  const handleChange = (newValue: string) => {
    // Word count validation
    const words = newValue.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length > maxWords && newValue.length > localValue.length) {
      return; // Don't allow more words
    }

    setLocalValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the parent update
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Flush pending changes when component unmounts or pin changes
  useEffect(() => {
    return () => {
      if (timeoutRef.current && localValue !== value) {
        clearTimeout(timeoutRef.current);
        onChange(localValue);
      }
    };
  }, [localValue, value, onChange]);

  const wordCount = localValue.trim() 
    ? localValue.trim().split(/\s+/).filter(w => w.length > 0).length 
    : 0;

  return (
    <div>
      <Textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      <p className="text-xs text-muted-foreground mt-1">
        {wordCount}/{maxWords} słów
      </p>
    </div>
  );
});

export default DebouncedTextarea;
