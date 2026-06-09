const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedImageType(file: File): file is File & { type: AllowedMime } {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
}

/**
 * Compresses an image via Canvas, capping dimensions and JPEG quality.
 * Targets < 150 KB per garment photo to protect Supabase free-tier storage
 * and keep LocalStorage Base64 strings small.
 *
 * Uses a proper "contain" scale — the shorter-side constraint determines the
 * scale factor, so landscape, portrait, and square photos all fit within the
 * maxWidth × maxHeight box while preserving aspect ratio.
 */
export function compressImage(
  file: File,
  maxWidth = 900,
  maxHeight = 900,
  quality = 0.75
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Contain-fit: find the largest uniform scale that keeps both
        // dimensions within their respective maxima
        const scale = Math.min(
          img.width  <= maxWidth  ? 1 : maxWidth  / img.width,
          img.height <= maxHeight ? 1 : maxHeight / img.height
        );
        const width  = Math.round(img.width  * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }));
            } else {
              reject(new Error('Canvas → Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
