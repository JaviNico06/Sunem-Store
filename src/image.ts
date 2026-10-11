export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageInfo {
  width: number;
  height: number;
}

export async function inspectImageFile(file: File): Promise<ImageInfo> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    throw new Error("Usa una imagen JPG, PNG o WebP.");
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error("Cada imagen debe pesar como máximo 5 MB.");
  if (!file.size) throw new Error("El archivo de imagen está vacío.");

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      const info = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (info.width && info.height) return info;
    }
  } catch {
    // Algunos navegadores móviles no implementan todos los decodificadores de
    // createImageBitmap. Se intenta también con el elemento de imagen nativo.
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ImageInfo>((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        image.naturalWidth && image.naturalHeight
          ? resolve({ width: image.naturalWidth, height: image.naturalHeight })
          : reject(new Error("Dimensiones inválidas."));
      image.onerror = () => reject(new Error("No se pudo decodificar."));
      image.src = url;
    });
  } catch {
    throw new Error(
      "El archivo no pudo abrirse como imagen. Prueba con otro JPG, PNG o WebP.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function imageExtension(file: File) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
}

export function dimensionsNotice(
  info: ImageInfo,
  expectedWidth: number,
  expectedHeight: number,
) {
  if (info.width === expectedWidth && info.height === expectedHeight) return "";
  return `La imagen mide ${info.width} × ${info.height} px; se recomiendan ${expectedWidth} × ${expectedHeight} px. Se mostrará completa, sin recorte.`;
}
