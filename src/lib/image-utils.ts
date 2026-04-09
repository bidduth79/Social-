/**
 * Compresses an image Base64 string or File by resizing it and converting it to a JPEG with lower quality.
 * @param source - The image File or Base64 string.
 * @param maxWidth - The maximum width of the compressed image.
 * @param maxHeight - The maximum height of the compressed image.
 * @param quality - The quality of the JPEG compression (0 to 1).
 * @returns A promise that resolves to the compressed Base64 string.
 */
/**
 * Extracts the first image URL from an HTML string.
 */
export function extractImageUrlFromHtml(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const img = doc.querySelector('img');
  return img ? img.src : null;
}

export async function compressImage(
  source: File | Blob | string,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      try {
        // Convert to JPEG with specified quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } catch (e) {
        console.error('Canvas toDataURL error (likely CORS):', e);
        // If it's a security error, we can't compress it, so we should have failed earlier
        // but as a last resort, if we have the original source and it's a string, we could resolve that
        // However, the caller handles the fallback if this promise rejects.
        reject(new Error('Failed to compress image due to security restrictions (CORS).'));
      }
    };

    img.onerror = (err) => {
      console.error('Image load error:', err);
      reject(new Error('Failed to load image. This might be due to CORS restrictions on the source URL.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}
