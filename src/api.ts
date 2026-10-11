import { createClient } from "@supabase/supabase-js";
import { demoProducts } from "./demo";
import type {
  Product,
  Movement,
  Photo,
  Promotion,
  PromotionSlot,
} from "./types";
import { imageExtension, inspectImageFile } from "./image";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
export const configured = Boolean(url && key && !url.includes("TU-PROYECTO"));
export const db = !isDemo && configured ? createClient(url, key) : null;
export const brand = import.meta.env.VITE_BRAND_NAME || "Duna";
let demo: Product[] = demoProducts();
let movements: Movement[] = [];
const demoPromotionPreview =
  isDemo && new URLSearchParams(location.search).has("promotions");
let demoPromotions: Promotion[] = [
  {
    slot: "left",
    name: demoPromotionPreview ? "Promoción izquierda de muestra" : "",
    alt_text: demoPromotionPreview ? "Promoción de muestra izquierda" : "",
    vertical_path: demoPromotionPreview ? "left/vertical-demo.png" : null,
    horizontal_path: demoPromotionPreview ? "left/horizontal-demo.png" : null,
    active: demoPromotionPreview,
    revision: 1,
    updated_at: new Date().toISOString(),
    vertical_url: demoPromotionPreview ? "/demo/blouse.png" : undefined,
    horizontal_url: demoPromotionPreview ? "/demo/earrings.png" : undefined,
  },
  {
    slot: "right",
    name: demoPromotionPreview ? "Promoción derecha de muestra" : "",
    alt_text: demoPromotionPreview ? "Promoción de muestra derecha" : "",
    vertical_path: demoPromotionPreview ? "right/vertical-demo.png" : null,
    horizontal_path: demoPromotionPreview ? "right/horizontal-demo.png" : null,
    active: demoPromotionPreview,
    revision: 1,
    updated_at: new Date().toISOString(),
    vertical_url: demoPromotionPreview ? "/demo/perfume.png" : undefined,
    horizontal_url: demoPromotionPreview ? "/demo/blouse.png" : undefined,
  },
];
// La demo vive en memoria: nunca se confunde con guardado en la nube.
const clone = <T>(v: T): T => structuredClone(v);
function client() {
  if (!db) throw new Error("Falta configurar la conexión. Consulta README.md.");
  return db;
}
export function errorText(err: unknown): string {
  const e = err as { message?: string; code?: string };
  if (e?.code === "23505")
    return "Ese código interno o código de barras ya existe. Revisa las variantes.";
  if (e?.message?.includes("Invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (e?.message?.includes("Failed to fetch"))
    return "No se pudo conectar. Comprueba internet y vuelve a intentarlo.";
  return e?.message || "No se pudo completar la operación.";
}
export async function adminAllowed() {
  if (isDemo) return true;
  const { data, error } = await client().rpc("is_admin");
  if (error) throw error;
  return data === true;
}
export async function listProducts(admin = false): Promise<Product[]> {
  if (isDemo) return clone(demo.filter((p) => admin || p.published));
  const all: Product[] = [];
  for (let from = 0; ; from += 300) {
    let query = client()
      .from("products")
      .select("*,variants(*),photos(*)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 299);
    if (!admin) query = query.eq("published", true);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as Product[]));
    if (data.length < 300) break;
  }
  if (admin) {
    // Obtener costos privados por lotes; nunca se consultan desde el catálogo público.
    const ids = all.flatMap((p) => p.variants.map((v) => v.id));
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await client()
        .from("variant_costs")
        .select("*")
        .in("variant_id", ids.slice(i, i + 300));
      if (error) throw error;
      const costs = new Map(data.map((c) => [c.variant_id, c.cost]));
      for (const p of all)
        for (const v of p.variants)
          if (costs.has(v.id)) v.cost = costs.get(v.id);
    }
  }
  const photos = all.flatMap((p) => p.photos);
  for (let i = 0; i < photos.length; i += 100) {
    const batch = photos.slice(i, i + 100);
    const { data, error } = await client()
      .storage.from("product-photos")
      .createSignedUrls(
        batch.map((p) => p.path),
        300,
      );
    if (error) throw error;
    batch.forEach((p, n) => {
      p.url = data[n]?.signedUrl ?? undefined;
    });
  }
  all.forEach((p) =>
    p.photos.sort(
      (a, b) => a.position - b.position || a.id.localeCompare(b.id),
    ),
  );
  return all;
}
export async function saveProduct(product: Product): Promise<string> {
  if (isDemo) {
    const existing = demo.find((p) => p.id === product.id);
    if (existing && existing.revision !== product.revision)
      throw new Error("El producto cambió. Actualiza y vuelve a intentarlo.");
    const p = clone(product);
    p.id ||= crypto.randomUUID();
    p.revision++;
    p.variants.forEach((v) => {
      v.id ||= crypto.randomUUID();
    });
    for (const v of p.variants) {
      if (
        demo.some(
          (other) =>
            other.id !== p.id &&
            other.variants.some(
              (w) => w.sku === v.sku || (v.barcode && w.barcode === v.barcode),
            ),
        )
      )
        throw new Error("Código duplicado.");
    }
    demo = demo.filter((x) => x.id !== p.id).concat(p);
    return p.id;
  }
  const { data, error } = await client().rpc("save_product", {
    payload: {
      ...product,
      id: product.id || null,
      variants: product.variants.map((v) => ({ ...v, id: v.id || null })),
    },
    expected_revision: product.revision || null,
  });
  if (error) throw error;
  return data as string;
}
export async function adjustStock(
  variant: string,
  delta: number,
  reason: string,
  request: string,
) {
  if (isDemo) {
    if (movements.some((m) => m.request_id === request)) return;
    const p = demo.find((p) => p.variants.some((v) => v.id === variant));
    const v = p?.variants.find((v) => v.id === variant);
    if (!v || !p) throw new Error("Variante inexistente.");
    if (v.stock + delta < 0) throw new Error("No hay suficientes existencias.");
    v.stock += delta;
    p.revision++;
    movements.unshift({
      id: crypto.randomUUID(),
      variant_id: variant,
      delta,
      reason,
      created_at: new Date().toISOString(),
      request_id: request,
    });
    return;
  }
  const { error } = await client().rpc("adjust_stock", {
    variant,
    change: delta,
    note: reason,
    request,
  });
  if (error) throw error;
}
export async function history(): Promise<Movement[]> {
  if (isDemo) return clone(movements);
  const { data, error } = await client()
    .from("inventory_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}
export async function uploadPhoto(
  productId: string,
  file: File,
  position: number,
): Promise<Photo> {
  await inspectImageFile(file);
  const ext = imageExtension(file);
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  if (isDemo) {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const photo = {
      id: crypto.randomUUID(),
      product_id: productId,
      path,
      position,
      url,
    };
    demo.find((p) => p.id === productId)?.photos.push(photo);
    return photo;
  }
  const { error: uploadError } = await client()
    .storage.from("product-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await client()
    .from("photos")
    .insert({ product_id: productId, path, position })
    .select()
    .single();
  if (error) {
    await client().storage.from("product-photos").remove([path]);
    throw error;
  }
  return data;
}
export async function removePhoto(photo: Photo) {
  if (isDemo) {
    const p = demo.find((p) => p.id === photo.product_id);
    if (p) p.photos = p.photos.filter((x) => x.id !== photo.id);
    return;
  }
  // Primero se quita la referencia pública. Un fallo posterior solo deja un
  // objeto huérfano privado, nunca una fotografía rota en el catálogo.
  const { error } = await client().from("photos").delete().eq("id", photo.id);
  if (error) throw error;
  const { error: storageError } = await client()
    .storage.from("product-photos")
    .remove([photo.path]);
  if (storageError)
    console.warn("No se pudo limpiar el archivo de la foto eliminada.", storageError);
}
export async function coverPhoto(photo: Photo) {
  if (isDemo) {
    const p = demo.find((p) => p.id === photo.product_id);
    p?.photos.forEach((ph) => {
      ph.position = ph.id === photo.id ? 0 : ph.position + 1;
    });
    return;
  }
  const { error } = await client().rpc("set_cover_photo", {
    photo_id: photo.id,
  });
  if (error) throw error;
}

export async function listPromotions(admin = false): Promise<Promotion[]> {
  if (isDemo)
    return clone(demoPromotions.filter((promotion) => admin || promotion.active));
  const { data, error } = admin
    ? await client().from("promotion_configs").select("*").order("slot")
    : await client().rpc("list_active_promotions");
  if (error) throw error;
  const promotions = (data as Partial<Promotion>[]).map((promotion) => ({
    name: "",
    revision: 0,
    updated_at: "",
    ...promotion,
  })) as Promotion[];
  const paths = promotions.flatMap((promotion) =>
    [promotion.vertical_path, promotion.horizontal_path].filter(
      (path): path is string => Boolean(path),
    ),
  );
  if (paths.length) {
    const { data: urls, error: urlError } = await client()
      .storage.from("promotion-images")
      .createSignedUrls(paths, 300);
    if (urlError) throw urlError;
    const signed = new Map(paths.map((path, index) => [path, urls[index]?.signedUrl]));
    promotions.forEach((promotion) => {
      promotion.vertical_url = promotion.vertical_path
        ? signed.get(promotion.vertical_path) || undefined
        : undefined;
      promotion.horizontal_url = promotion.horizontal_path
        ? signed.get(promotion.horizontal_path) || undefined
        : undefined;
    });
  }
  return promotions;
}

async function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

export async function uploadPromotionImage(
  slot: PromotionSlot,
  kind: "vertical" | "horizontal",
  file: File,
) {
  await inspectImageFile(file);
  const path = `${slot}/${kind}-${crypto.randomUUID()}.${imageExtension(file)}`;
  if (isDemo) return { path, url: await fileDataUrl(file) };
  const { error } = await client()
    .storage.from("promotion-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path };
}

export async function savePromotion(promotion: Promotion) {
  if (isDemo) {
    const current = demoPromotions.find((item) => item.slot === promotion.slot);
    if (!current || current.revision !== promotion.revision)
      throw new Error(
        "La promoción cambió en otra sesión. Actualiza y vuelve a intentarlo.",
      );
    if (promotion.active && !promotion.vertical_path)
      throw new Error("Agrega una imagen vertical antes de activar el panel.");
    demoPromotions = demoPromotions.map((item) =>
      item.slot === promotion.slot
        ? {
            ...clone(promotion),
            revision: item.revision + 1,
            updated_at: new Date().toISOString(),
          }
        : item,
    );
    return;
  }
  const { error } = await client().rpc("save_promotion", {
    p_slot: promotion.slot,
    p_name: promotion.name,
    p_alt_text: promotion.alt_text,
    p_active: promotion.active,
    p_vertical_path: promotion.vertical_path,
    p_horizontal_path: promotion.horizontal_path,
    p_expected_revision: promotion.revision,
  });
  if (error) throw error;
}

export async function removePromotionImages(paths: string[]) {
  if (isDemo || !paths.length) return;
  const { error } = await client()
    .storage.from("promotion-images")
    .remove([...new Set(paths)]);
  if (error) throw error;
}
