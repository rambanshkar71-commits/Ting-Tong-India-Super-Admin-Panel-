import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export interface ProcessedImage {
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
}

/**
 * Compresses and resizes an image file or camera snapshot using HTML5 Canvas.
 */
export async function processImageFile(
  file: File | Blob,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.82
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            resolve({
              dataUrl,
              blob: blob || undefined,
              width,
              height
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image data URL to Firebase Storage with fallback to data URL
 * if Storage is unbound or offline.
 */
export async function uploadImageToStorage(
  dataUrl: string,
  folderPath: string,
  fileName: string
): Promise<string> {
  try {
    const storagePath = `${folderPath}/${Date.now()}_${fileName}`;
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, dataUrl, 'data_url');
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.warn('Firebase storage upload fallback to dataUrl:', err);
    // If storage is not available/configured, dataUrl persists seamlessly
    return dataUrl;
  }
}
