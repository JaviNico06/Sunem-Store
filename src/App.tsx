import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  Search,
  ArrowUpRight,
  SlidersHorizontal,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import {
  brand,
  isDemo,
  configured,
  db,
  listProducts,
  listPromotions,
  errorText,
} from "./api";
import {
  categories,
  genders,
  categoryName,
  money,
  minPrice,
  activeVariants,
  totalStock,
  variantLabel,
  type Product,
  type Promotion,
  type PromotionSlot,
} from "./types";
import { Modal, Notice, ProductImage } from "./ui";
const Admin = lazy(() => import("./Admin"));
export default function App() {
  const admin = location.pathname.startsWith("/admin");
  useEffect(() => {
    document.title = `${brand} Boutique · ${admin ? "Administración" : "Catálogo"}`;
  }, [admin]);
  if (!isDemo && !configured)
    return (
      <main className="setup">
        <div className="wordmark">
          {brand}
          <span>BOUTIQUE</span>
        </div>
        <h1>Tu boutique está casi lista.</h1>
        <p>
          Falta conectar la base de datos. Sigue los pasos de{" "}
          <strong>README.md</strong> y configura las variables de entorno en
          Vercel.
        </p>
        <p>
          Para explorar la muestra en tu computadora:{" "}
          <code>npm run dev:demo</code>.
        </p>
      </main>
    );
  return (
    <>
      {isDemo && (
        <div className="demo-banner">
          Vista de demostración · Productos ficticios · Los cambios se pierden
          al recargar
        </div>
      )}
      {admin ? (
        <Suspense fallback={<p className="loading">Abriendo tu boutique…</p>}>
          <Admin />
        </Suspense>
      ) : (
        <Catalog />
      )}
    </>
  );
}
function Catalog() {
  const [products, setProducts] = useState<Product[]>([]),
    [promotions, setPromotions] = useState<Promotion[]>([]),
    [failedPromotionSlots, setFailedPromotionSlots] = useState<
      Set<PromotionSlot>
    >(new Set()),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [gender, setGender] = useState(""),
    [available, setAvailable] = useState(false),
    [sort, setSort] = useState("new"),
    [selected, setSelected] = useState<Product | null>(null),
    [filters, setFilters] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [productResult, promotionResult] = await Promise.allSettled([
        listProducts(),
        listPromotions(),
      ]);
      if (productResult.status === "rejected") throw productResult.reason;
      setProducts(productResult.value);
      if (promotionResult.status === "fulfilled") {
        setPromotions(promotionResult.value);
        setFailedPromotionSlots(new Set());
      } else {
        setPromotions([]);
        console.warn("No se pudieron cargar las promociones.", promotionResult.reason);
      }
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  useEffect(() => {
    if (!db) return;
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    };
    const channel = db
      .channel("catalog-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        changed,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "variants" },
        changed,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photos" },
        changed,
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void db?.removeChannel(channel);
    };
  }, [refresh]);
  const normalized = search.toLocaleLowerCase("es");
  const results = products
    .filter(
      (p) =>
        activeVariants(p).length &&
        (!category || p.category_id === category) &&
        (!gender || p.gender === gender) &&
        (!available || totalStock(p) > 0) &&
        [
          p.name,
          p.brand,
          p.description,
          ...p.variants.flatMap((v) => [v.sku, v.barcode || ""]),
        ]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(normalized),
    )
    .sort((a, b) =>
      sort === "low"
        ? minPrice(a) - minPrice(b)
        : sort === "high"
          ? minPrice(b) - minPrice(a)
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : b.created_at.localeCompare(a.created_at),
    );
  const clear = () => {
    setSearch("");
    setCategory("");
    setGender("");
    setAvailable(false);
    setSort("new");
  };
  const leftPromotion = promotions.find(
    (promotion) =>
      promotion.slot === "left" &&
      promotion.vertical_url &&
      !failedPromotionSlots.has("left"),
  );
  const rightPromotion = promotions.find(
    (promotion) =>
      promotion.slot === "right" &&
      promotion.vertical_url &&
      !failedPromotionSlots.has("right"),
  );
  const promotionUnavailable = (slot: PromotionSlot) =>
    setFailedPromotionSlots((current) => new Set(current).add(slot));
  const promotionClass = leftPromotion && rightPromotion
    ? "promotions-both"
    : leftPromotion
      ? "promotion-left-only"
      : rightPromotion
        ? "promotion-right-only"
        : "no-promotions";
  return (
    <div className="catalog">
      <div className="announcement">Pequeños detalles. Mucho de ti.</div>
      <header className="site-header">
        <a
          className="wordmark"
          href="/"
          aria-label={`${brand} Boutique, inicio`}
        >
          {brand}
          <span>BOUTIQUE</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#coleccion" className="nav-active">
            La colección
          </a>
          <a href="#categorias">Categorías</a>
        </nav>
        <span className="header-note">
          Una selección para ti <span>✧</span>
        </span>
      </header>
      <main className={`catalog-layout ${promotionClass}`}>
        {leftPromotion && (
          <PromotionPanel
            key={`desktop-${leftPromotion.vertical_path}`}
            promotion={leftPromotion}
            placement="desktop"
            onUnavailable={promotionUnavailable}
          />
        )}
        <div className="catalog-center">
          <section className="collection-intro">
          <div>
            <p className="eyebrow">EL ARTE DE ELEGIR LO QUE TE GUSTA</p>
            <h1>
              Tu estilo.
              <br />
              <em>Tu esencia.</em>
            </h1>
          </div>
          <div className="intro-aside">
            <span className="asterisk" aria-hidden="true">
              *
            </span>
            <p>
              Ropa, joyería y aromas.
              <br />
              Encuentra esos detalles
              <br />
              que se sienten como tú.
            </p>
            <a href="#coleccion">
              Explorar colección <ArrowDown />
            </a>
          </div>
          </section>
          {(leftPromotion || rightPromotion) && (
            <div className="inline-promotions" aria-label="Promociones">
              {leftPromotion && (
                <PromotionPanel
                  key={`inline-${leftPromotion.vertical_path}-${leftPromotion.horizontal_path}`}
                  promotion={leftPromotion}
                  placement="inline"
                  onUnavailable={promotionUnavailable}
                />
              )}
              {rightPromotion && (
                <PromotionPanel
                  key={`inline-${rightPromotion.vertical_path}-${rightPromotion.horizontal_path}`}
                  promotion={rightPromotion}
                  placement="inline"
                  onUnavailable={promotionUnavailable}
                />
              )}
            </div>
          )}
          <section
          id="coleccion"
          className="collection"
          aria-label="Catálogo de productos"
        >
          <div className="category-tabs" id="categorias">
            <button
              className={!category ? "active" : ""}
              onClick={() => setCategory("")}
            >
              Toda la colección
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="catalog-tools">
            <label className="search-field">
              <Search size={19} />
              <input
                aria-label="Buscar productos"
                placeholder="Encuentra algo especial…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="tool-right">
              <button
                className={filters ? "filter-button selected" : "filter-button"}
                onClick={() => setFilters(!filters)}
                aria-expanded={filters}
              >
                <SlidersHorizontal size={16} />
                Filtros
                {(gender || available) && <span className="filter-dot" />}
              </button>
              <select
                aria-label="Ordenar productos"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="new">Más recientes</option>
                <option value="low">Precio: menor a mayor</option>
                <option value="high">Precio: mayor a menor</option>
                <option value="name">Nombre: A a Z</option>
              </select>
            </div>
          </div>
          {filters && (
            <div className="filter-panel">
              <label>
                Género
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Todos</option>
                  {genders.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                />
                Solo disponibles
              </label>
              <button className="text-button" onClick={clear}>
                Restablecer
              </button>
            </div>
          )}
          <div className="result-line">
            <span>
              {loading
                ? "Buscando piezas…"
                : `${results.length} ${results.length === 1 ? "pieza" : "piezas"}`}
            </span>
            <span>Elegidas con intención</span>
          </div>
          {error && (
            <Notice error>
              {error}{" "}
              <button className="text-button" onClick={() => void refresh()}>
                Reintentar
              </button>
            </Notice>
          )}
          {loading ? (
            <div className="product-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton" />
              ))}
            </div>
          ) : results.length ? (
            <div className="product-grid">
              {results.map((p) => (
                <button
                  className="product-card"
                  key={p.id}
                  onClick={() => setSelected(p)}
                  aria-label={`Ver ${p.name}`}
                >
                  <div className="product-image">
                    <ProductImage url={p.photos[0]?.url} name={p.name} />
                    <span
                      className={
                        totalStock(p) > 0 ? "stock-pill" : "stock-pill sold-out"
                      }
                    >
                      {totalStock(p) > 0 ? "Disponible" : "Agotado"}
                    </span>
                    <span className="card-arrow">
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                  <div className="product-meta">
                    <span>{categoryName(p.category_id)}</span>
                    <span>{p.gender}</span>
                  </div>
                  <div className="product-title">
                    <h2>{p.name}</h2>
                    <span>{money(minPrice(p))}</span>
                  </div>
                  <p className="product-options">
                    {activeVariants(p).length > 1
                      ? `${activeVariants(p).length} opciones`
                      : variantLabel(activeVariants(p)[0])}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>
                {products.length
                  ? "No encontramos esa combinación."
                  : "La colección está por llegar."}
              </h2>
              <p>
                {products.length
                  ? "Prueba otra búsqueda o cambia los filtros."
                  : "Pronto encontrarás aquí nuestras piezas."}
              </p>
              {products.length > 0 && (
                <button onClick={clear}>Ver toda la colección</button>
              )}
            </div>
          )}
          </section>
        </div>
        {rightPromotion && (
          <PromotionPanel
            key={`desktop-${rightPromotion.vertical_path}`}
            promotion={rightPromotion}
            placement="desktop"
            onUnavailable={promotionUnavailable}
          />
        )}
      </main>
      <footer className="site-footer">
        <div className="wordmark">
          {brand}
          <span>BOUTIQUE</span>
        </div>
        <p>Detalles que hablan de ti.</p>
        <div>
          <span>Precios en MXN</span>
          <a href="/admin">
            Acceso privado <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
      {selected && (
        <ProductDetail
          product={products.find((p) => p.id === selected.id) ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function PromotionPanel({
  promotion,
  placement,
  onUnavailable,
}: {
  promotion: Promotion;
  placement: "desktop" | "inline";
  onUnavailable: (slot: PromotionSlot) => void;
}) {
  const [useVerticalFallback, setUseVerticalFallback] = useState(false);
  const source =
    placement === "inline" && !useVerticalFallback
      ? promotion.horizontal_url || promotion.vertical_url
      : promotion.vertical_url;
  if (!source) return null;
  return (
    <aside
      className={`promotion-panel promotion-${promotion.slot} promotion-${placement}`}
      aria-label={`Publicidad ${promotion.slot === "left" ? "izquierda" : "derecha"}`}
    >
      <img
        src={source}
        alt={promotion.alt_text}
        onError={() => {
          if (
            placement === "inline" &&
            !useVerticalFallback &&
            promotion.horizontal_url &&
            promotion.vertical_url &&
            promotion.horizontal_url !== promotion.vertical_url
          ) {
            setUseVerticalFallback(true);
          } else {
            onUnavailable(promotion.slot);
          }
        }}
      />
    </aside>
  );
}
function ArrowDown() {
  return <ArrowRight size={17} className="down-arrow" />;
}
function ProductDetail({
  product: p,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState(0),
    [variant, setVariant] = useState("");
  if (!p)
    return (
      <Modal title="Producto no disponible" onClose={onClose}>
        <p>Esta pieza ya no está publicada.</p>
      </Modal>
    );
  const variants = activeVariants(p),
    v = variants.find((x) => x.id === variant) || variants[0];
  return (
    <Modal title={p.name} onClose={onClose} wide>
      <div className="detail-grid">
        <div>
          <div className="detail-image">
            <ProductImage
              url={p.photos[photo]?.url || p.photos[0]?.url}
              name={p.name}
            />
          </div>
          {p.photos.length > 1 && (
            <div className="thumbnails">
              {p.photos.map((ph, i) => (
                <button
                  key={ph.id}
                  className={photo === i ? "chosen" : ""}
                  onClick={() => setPhoto(i)}
                  aria-label={`Foto ${i + 1}`}
                >
                  <ProductImage
                    url={ph.url}
                    name={`${p.name}, foto ${i + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {categoryName(p.category_id)} · {p.gender}
          </p>
          <h3>{p.name}</h3>
          {p.brand && <p className="muted">{p.brand}</p>}
          <p className="detail-price">
            {v ? money(v.price) : "Sin variantes disponibles"}{" "}
            <small>MXN</small>
          </p>
          <p className="description">{p.description}</p>
          <fieldset className="variant-select">
            <legend>Elige tu opción</legend>
            {variants.map((item) => (
              <button
                key={item.id}
                className={v?.id === item.id ? "selected" : ""}
                onClick={() => setVariant(item.id)}
              >
                {variantLabel(item)}
                {item.stock === 0 ? " · Agotado" : ""}
              </button>
            ))}
          </fieldset>
          <p className={v?.stock ? "availability" : "muted"}>
            {v?.stock ? (
              <>
                <Check size={17} /> Disponible
              </>
            ) : (
              "Por ahora, agotado"
            )}
          </p>
          {v && <p className="reference">Referencia {v.sku}</p>}
          <div className="catalog-only">
            Catálogo de exhibición. Consulta con la boutique para adquirir esta
            pieza.
          </div>
        </div>
      </div>
    </Modal>
  );
}
