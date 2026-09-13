const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.88;
// El socket del servidor admite hasta 8MB por mensaje y base64 agrega ~33%.
const MAX_RAW_BYTES = 5 * 1024 * 1024;

export const DIAGRAM_FILE_ACCEPT = 'image/*,.heic,.heif,application/pdf,.pdf';

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'application/octet-stream';
}

// Una foto de celular puede pesar varios MB: se reduce a un tamano que
// conserva legible el texto del diagrama (2000px) y se recomprime a JPEG.
function resizeToJpeg(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen'));
        return;
      }
      // Fondo blanco: un PNG transparente (captura de otra herramienta) se
      // veria negro al pasarlo a JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ base64: canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] ?? '', mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El navegador no pudo abrir la imagen'));
    };

    img.src = objectUrl;
  });
}

// Prepara cualquier archivo con un diagrama para mandarlo a la IA:
// - Imagenes que el navegador sabe abrir (JPG, PNG, WEBP, GIF, BMP, SVG):
//   se redimensionan y convierten a JPEG.
// - PDF y fotos HEIC/HEIF de iPhone (el navegador no las abre, pero la IA
//   si): se envian tal cual si no superan el limite de tamano.
export async function prepareDiagramFile(file: File): Promise<{ base64: string; mimeType: string }> {
  const mimeType = guessMimeType(file);
  const sendRaw = async () => {
    if (file.size > MAX_RAW_BYTES) {
      throw new Error('El archivo supera 5 MB: exporta una sola pagina o una captura mas liviana');
    }
    return { base64: await readAsBase64(file), mimeType };
  };

  if (mimeType === 'application/pdf' || mimeType === 'image/heic' || mimeType === 'image/heif') {
    return sendRaw();
  }
  if (!mimeType.startsWith('image/')) {
    throw new Error('Formato no soportado: usa una imagen (JPG, PNG, WEBP, HEIC...) o un PDF');
  }
  return resizeToJpeg(file);
}
