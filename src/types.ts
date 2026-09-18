export const categories = [
  { id: "ropa", name: "Ropa" },
  { id: "joyeria", name: "Joyería" },
  { id: "perfumes", name: "Perfumes" },
  { id: "calzado", name: "Calzado" },
  { id: "gorras", name: "Gorras" },
];
export const genders = ["Mujer", "Hombre", "Unisex", "No aplica"];
export interface Variant {
  id: string;
  product_id?: string;
  sku: string;
  barcode: string | null;
  size: string;
  color: string;
  presentation: string;
  price: number;
  stock: number;
  active: boolean;
  cost?: number | null;
}
export interface Photo {
  id: string;
  product_id: string;
  path: string;
  position: number;
  url?: string;
}
export interface Product {
  id: string;
  name: string;
  description: string;
  brand: string;
  category_id: string;
  gender: string;
  published: boolean;
  revision: number;
  created_at: string;
  variants: Variant[];
  photos: Photo[];
}
export interface Movement {
  id: string;
  variant_id: string;
  delta: number;
  reason: string;
  created_at: string;
  request_id: string;
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
export const variantLabel = (v: Variant) =>
  [v.color, v.size, v.presentation].filter(Boolean).join(" · ") || "Única";
export const activeVariants = (p: Product) =>
  p.variants.filter((v) => v.active);
export const totalStock = (p: Product) =>
  activeVariants(p).reduce((n, v) => n + v.stock, 0);
export const minPrice = (p: Product) =>
  Math.min(...activeVariants(p).map((v) => Number(v.price)));
export const categoryName = (id: string) =>
  categories.find((c) => c.id === id)?.name || id;
export function freshVariant(): Variant {
  return {
    id: "",
    sku: "DUN-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    barcode: "",
    size: "",
    color: "",
    presentation: "",
    price: 0,
    stock: 0,
    active: true,
    cost: null,
  };
}
export function freshProduct(): Product {
  return {
    id: "",
    name: "",
    description: "",
    brand: "",
    category_id: "ropa",
    gender: "Mujer",
    published: false,
    revision: 0,
    created_at: new Date().toISOString(),
    variants: [freshVariant()],
    photos: [],
  };
}
