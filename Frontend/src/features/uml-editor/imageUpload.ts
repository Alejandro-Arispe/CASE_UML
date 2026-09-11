const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

// Una foto de celular sin procesar puede pesar varios MB; se reduce a un
// tamaño razonable para legibilidad de texto (1600px) y se recomprime a
// JPEG antes de mandarla por el socket (hay un limite de payload en el
// servidor, y ademas una imagen mas chica es una llamada a la IA mas rapida).
export function resizeImageFile(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve({ base64, mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El archivo no es una imagen valida'));
    };

    img.src = objectUrl;
  });
}
