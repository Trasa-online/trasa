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
 * Returns a random placeholder image URL for pins without photos.
 * Uses the pin ID to generate a consistent placeholder for the same pin.
 */
export function getRandomPinPlaceholder(pinId?: string): string {
  if (pinId) {
    // Use pin ID to generate consistent placeholder for same pin
    let hash = 0;
    for (let i = 0; i < pinId.length; i++) {
      const char = pinId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const index = Math.abs(hash) % PIN_PLACEHOLDERS.length;
    return PIN_PLACEHOLDERS[index];
  }
  // Random placeholder if no pin ID
  return PIN_PLACEHOLDERS[Math.floor(Math.random() * PIN_PLACEHOLDERS.length)];
}

/**
 * Returns the first available image for a pin, or a placeholder if none exists.
 */
export function getPinImage(pin: { id?: string; images?: string[] | null; image_url?: string | null }): string {
  // Check for images array first
  if (pin.images && pin.images.length > 0 && pin.images[0]) {
    return pin.images[0];
  }
  // Check for single image_url
  if (pin.image_url) {
    return pin.image_url;
  }
  // Return consistent placeholder based on pin ID
  return getRandomPinPlaceholder(pin.id);
}
