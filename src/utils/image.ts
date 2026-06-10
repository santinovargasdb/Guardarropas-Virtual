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

/**
 * Best-effort automatic background remover for product-style photos shot on a
 * FLAT, light background (basic chroma keying). Samples the four corners; if they
 * are uniform and light, it knocks out near-background pixels (alpha → 0) and
 * returns a transparent PNG so the garment can "dress" the mannequin cleanly.
 *
 * Returns `null` (never rejects) when no flat light background is detected, the
 * canvas is tainted, or the result looks unreliable — so the caller can safely
 * fall back to the normal compressed JPEG.
 */
export function removeFlatBackground(
  file: File,
  maxSize = 700,
  threshold = 38,
): Promise<File | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);

        let data: ImageData;
        try {
          data = ctx.getImageData(0, 0, w, h);
        } catch {
          resolve(null); // tainted (cross-origin) canvas
          return;
        }
        const px = data.data;

        // Estimate background colour from the four corners.
        const corners = [0, (w - 1) * 4, w * (h - 1) * 4, (w * h - 1) * 4];
        let br = 0, bg = 0, bb = 0;
        for (const c of corners) { br += px[c]; bg += px[c + 1]; bb += px[c + 2]; }
        br /= 4; bg /= 4; bb /= 4;

        // Only proceed when the background is light AND low-variance (flat).
        const lum = 0.299 * br + 0.587 * bg + 0.114 * bb;
        let variance = 0;
        for (const c of corners) {
          variance += Math.abs(px[c] - br) + Math.abs(px[c + 1] - bg) + Math.abs(px[c + 2] - bb);
        }
        if (lum < 180 || variance > 120) { resolve(null); return; }

        // Knock out pixels close to the background colour.
        const cutoff = threshold * 3; // distance is summed over 3 channels
        let removed = 0;
        for (let i = 0; i < px.length; i += 4) {
          const dist = Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb);
          if (dist <= cutoff) { px[i + 3] = 0; removed++; }
        }

        // Bail if almost nothing or almost everything was removed (unreliable).
        const ratio = removed / (px.length / 4);
        if (ratio < 0.05 || ratio > 0.92) { resolve(null); return; }

        ctx.putImageData(data, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(null); return; }
            const name = file.name.replace(/\.[^.]+$/, '') + '.png';
            resolve(new File([blob], name, { type: 'image/png', lastModified: Date.now() }));
          },
          'image/png'
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
