import { FIELD_LIMITS } from '../types';

export interface ProcessedUploadImage {
  dataUrl: string;
  width: number;
  height: number;
  approxKb: number;
}

const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB raw upload limit

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the selected image file.'));
    img.src = objectUrl;
  });
}

export async function compressListingImageFile(
  file: File
): Promise<ProcessedUploadImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" is not a supported image file.`);
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error(`"${file.name}" exceeds the 15 MB upload limit.`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing canvas is unavailable in this browser.');
    }

    const maxDims = [960, 760, 600, 480];
    const qualities = [0.82, 0.72, 0.6, 0.5];

    for (const maxEdge of maxDims) {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      for (const quality of qualities) {
        const webpUrl = canvas.toDataURL('image/webp', quality);
        const candidateUrl = webpUrl.startsWith('data:image/webp')
          ? webpUrl
          : canvas.toDataURL('image/jpeg', quality);

        if (candidateUrl.length <= FIELD_LIMITS.IMAGE_URL_MAX) {
          return {
            dataUrl: candidateUrl,
            width: targetWidth,
            height: targetHeight,
            approxKb: Math.round((candidateUrl.length * 0.75) / 1024),
          };
        }
      }
    }

    throw new Error(
      `"${file.name}" is too detailed to compress cleanly. Try a smaller photo.`
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isValidListingImageSource(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > FIELD_LIMITS.IMAGE_URL_MAX) return false;
  return (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmed)
  );
}
