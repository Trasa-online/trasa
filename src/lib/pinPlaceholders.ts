// List of placeholder images for pins without user photos
const PIN_PLACEHOLDERS = [
  '/placeholders/placeholder-01.png',
  '/placeholders/placeholder-02.png',
  '/placeholders/placeholder-03.png',
  '/placeholders/placeholder-04.png',
  '/placeholders/placeholder-05.png',
  '/placeholders/placeholder-06.png',
  '/placeholders/placeholder-07.png',
  '/placeholders/placeholder-08.png',
  '/placeholders/placeholder-09.png',
  '/placeholders/placeholder-10.png',
];

/**
 * Returns a placeholder index based on pin ID hash.
 */
function getPlaceholderIndex(pinId?: string): number {
  if (pinId) {
    let hash = 0;
    for (let i = 0; i < pinId.length; i++) {
      const char = pinId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % PIN_PLACEHOLDERS.length;
  }
  return Math.floor(Math.random() * PIN_PLACEHOLDERS.length);
}

/**
 * Returns a random placeholder image URL for pins without photos.
 * Uses the pin ID to generate a consistent placeholder for the same pin.
 */
export function getRandomPinPlaceholder(pinId?: string): string {
  return PIN_PLACEHOLDERS[getPlaceholderIndex(pinId)];
}

/**
 * Returns the first available image for a pin, or a placeholder if none exists.
 */
export function getPinImage(pin: { id?: string; images?: string[] | null; image_url?: string | null }): string {
  if (pin.images && pin.images.length > 0 && pin.images[0]) {
    return pin.images[0];
  }
  if (pin.image_url) {
    return pin.image_url;
  }
  return getRandomPinPlaceholder(pin.id);
}

type PinWithImage = { id?: string; images?: string[] | null; image_url?: string | null };

/**
 * Returns images for a list of pins, ensuring consecutive placeholders are never the same.
 * This should be used when displaying a list of pins in order.
 */
export function getPinImagesForRoute(pins: PinWithImage[]): string[] {
  const result: string[] = [];
  let lastPlaceholderIndex = -1;

  for (const pin of pins) {
    // If pin has its own image, use it
    if (pin.images && pin.images.length > 0 && pin.images[0]) {
      result.push(pin.images[0]);
      lastPlaceholderIndex = -1; // Reset since we used a real image
      continue;
    }
    if (pin.image_url) {
      result.push(pin.image_url);
      lastPlaceholderIndex = -1;
      continue;
    }

    // Need a placeholder - ensure it's different from the previous one
    let placeholderIndex = getPlaceholderIndex(pin.id);
    
    if (placeholderIndex === lastPlaceholderIndex) {
      // Pick a different placeholder
      placeholderIndex = (placeholderIndex + 1) % PIN_PLACEHOLDERS.length;
    }

    lastPlaceholderIndex = placeholderIndex;
    result.push(PIN_PLACEHOLDERS[placeholderIndex]);
  }

  return result;
}
