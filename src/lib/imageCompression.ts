/**
 * Compress an image file before uploading
 * @param file The image file to compress
 * @param maxWidth Maximum width of the output image (default: 1920)
 * @param maxHeight Maximum height of the output image (default: 1920)
 * @param quality JPEG quality (0-1, default: 0.8)
 * @returns Promise with compressed Blob
 */
export const compressImage = async (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Use better image smoothing for quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Log compression stats
            const originalSize = file.size;
            const compressedSize = blob.size;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(
              `Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`
            );
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Create object URL and load image
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Compress a base64 data URL image
 * @param dataUrl Base64 data URL string
 * @param maxWidth Maximum width of the output image
 * @param maxHeight Maximum height of the output image
 * @param quality JPEG quality (0-1)
 * @returns Promise with compressed base64 data URL
 */
export const compressDataUrl = async (
  dataUrl: string,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = dataUrl;
  });
};
