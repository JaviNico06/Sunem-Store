import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  Plus,
  Search,
  Package,
  ExternalLink,
  LogOut,
  RefreshCw,
  Pencil,
  ArrowDownUp,
  LayoutGrid,
  History,
  ImagePlus,
  Trash2,
  Star,
  Barcode,
  Cloud,
  Menu,
  Check,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  brand,
  isDemo,
  db,
  adminAllowed,
  errorText,
  listProducts,
  saveProduct,
  adjustStock,
  history,
  uploadPhoto,
  removePhoto,
  coverPhoto,
  listPromotions,
  uploadPromotionImage,
  savePromotion,
  removePromotionImages,
} from "./api";
import {
  type Product,
  type Variant,
  type Movement,
  type Promotion,
  type PromotionSlot,
  categories,
  genders,
  freshProduct,
  freshVariant,
  totalStock,
  categoryName,
  money,
  variantLabel,
} from "./types";
import { Modal, Notice, ProductImage } from "./ui";
import {
  dimensionsNotice,
  inspectImageFile,
  type ImageInfo,
} from "./image";
export default function Admin() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(isDemo),
    [allowed, setAllowed] = useState(isDemo),
    [authError, setAuthError] = useState(""),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!db) return;
    let live = true;
    void db.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setAuthReady(true);
        if (error) setAuthError(errorText(error));
      }
    });
    const { data } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (isDemo) return;
    setAllowed(false);
    if (!session) return;
    let live = true;
    void adminAllowed()
      .then((ok) => {
        if (live) {
          setAllowed(ok);
          setAuthError(
            ok ? "" : "Esta cuenta no tiene permisos de administración.",
          );
        }
      })
      .catch((e) => {
        if (live) setAuthError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [session]);
  if (recovery) return <PasswordChange onDone={() => setRecovery(false)} />;
  if (!authReady) return <p className="loading">Verificando sesión…</p>;
  if (!isDemo && !session) return <Login />;
  if (!allowed)
    return (
      <main className="setup">
        <h1>Verificando acceso</h1>
        {authError && <Notice error>{authError}</Notice>}
        <button onClick={() => void db?.auth.signOut()}>
          Volver al inicio de sesión
        </button>
      </main>
    );
  return <Workspace email={session?.user.email || "Vista de demostración"} />;
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await db!.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email) {
      setError("Escribe tu correo para recibir el enlace.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await db!.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + "/admin",
      });
      if (error) throw error;
      setMessage(
        "Si el correo tiene una cuenta, recibirá un enlace para cambiar su contraseña.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="wordmark">
          {brand}
          <span>BOUTIQUE</span>
        </div>
        <h1>
          Todo lo que
          <br />
          hace única
          <br />
          <em>a tu boutique.</em>
        </h1>
        <p>Tu colección, en un solo lugar.</p>
        <span className="login-flower">*</span>
      </section>
      <section className="login-form">
        <p className="eyebrow">ESPACIO PRIVADO</p>
        <h2>Qué gusto verte.</h2>
        <p className="muted">Entra para cuidar cada detalle de tu colección.</p>
        <form onSubmit={submit}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          <button className="primary" disabled={busy}>
            {busy ? "Un momento…" : "Entrar a mi boutique"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => void reset()}
            disabled={busy}
          >
            Olvidé mi contraseña
          </button>
        </form>
        <a className="back-link" href="/">
          Volver al catálogo
        </a>
      </section>
    </main>
  );
}
function PasswordChange({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await db!.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup">
      <h1>Cambia tu contraseña</h1>
      <form onSubmit={submit}>
        <label>
          Nueva contraseña
          <input
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Repite la contraseña
          <input
            type="password"
            required
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error && <Notice error>{error}</Notice>}
        <button disabled={busy}>Guardar contraseña</button>
      </form>
    </main>
  );
}
function Workspace({ email }: { email: string }) {
  const [products, setProducts] = useState<Product[]>([]),
    [promotions, setPromotions] = useState<Promotion[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [view, setView] = useState("products"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [publication, setPublication] = useState(""),
    [editor, setEditor] = useState<Product | null>(null),
    [stock, setStock] = useState<Product | null>(null),
    [logs, setLogs] = useState<Movement[]>([]),
    [menu, setMenu] = useState(false),
    [lastSync, setLastSync] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [p, m, promotions] = await Promise.all([
        listProducts(true),
        history(),
        listPromotions(true),
      ]);
      setProducts(p);
      setLogs(m);
      setPromotions(promotions);
      setLastSync(
        new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
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
  const filtered = products.filter(
    (p) =>
      (!category || p.category_id === category) &&
      (!publication ||
        (publication === "published" ? p.published : !p.published)) &&
      [p.name, p.brand, ...p.variants.flatMap((v) => [v.sku, v.barcode || ""])]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function saved() {
    setEditor(null);
    setSuccess(
      isDemo
        ? "Guardado en la demostración temporal."
        : "Producto guardado en la nube.",
    );
    await refresh();
  }
  const promotionSlot: PromotionSlot | null =
    view === "promotion-left"
      ? "left"
      : view === "promotion-right"
        ? "right"
        : null;
  const viewTitle =
    view === "products"
      ? "Tu colección"
      : view === "history"
        ? "Movimientos"
        : promotionSlot === "left"
          ? "Panel izquierdo"
          : "Panel derecho";
  const viewDescription =
    view === "products"
      ? "Un espacio para todas tus piezas especiales."
      : view === "history"
        ? "Entradas y salidas de tu inventario."
        : "Configura la publicidad que aparecerá en el catálogo.";
  return (
    <div className="admin-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="wordmark" href="/">
          {brand}
          <span>BOUTIQUE</span>
        </a>
        <p className="sidebar-label">MI BOUTIQUE</p>
        <nav>
          <button
            className={view === "products" ? "active" : ""}
            onClick={() => {
              setView("products");
              setMenu(false);
            }}
          >
            <LayoutGrid size={19} />
            Productos<span>{products.length}</span>
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => {
              setView("history");
              setMenu(false);
            }}
          >
            <History size={19} />
            Movimientos
          </button>
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={19} />
            Ver catálogo
          </a>
          <button
            className={view === "promotion-left" ? "active" : ""}
            onClick={() => {
              setView("promotion-left");
              setMenu(false);
            }}
          >
            <PanelLeft size={19} />
            Panel izquierdo
          </button>
          <button
            className={view === "promotion-right" ? "active" : ""}
            onClick={() => {
              setView("promotion-right");
              setMenu(false);
            }}
          >
            <PanelRight size={19} />
            Panel derecho
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="cloud-note">
            <Cloud size={20} />
            <div>
              {isDemo ? "Demostración temporal" : "Inventario en la nube"}
              <small>
                {isDemo
                  ? "Sin datos reales"
                  : `Última lectura: ${lastSync || "conectando"}`}
              </small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">{brand[0]}</span>
            <div>
              <strong>Administración</strong>
              <small>{email}</small>
            </div>
          </div>
          {!isDemo && (
            <button
              className="text-button"
              onClick={async () => {
                const { error } = await db!.auth.signOut();
                if (error) setError(errorText(error));
              }}
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>
            Mi boutique{" "}
            <span className="breadcrumb">/ {viewTitle}</span>
          </span>
          <button className="text-button" onClick={() => void refresh()}>
            <RefreshCw size={15} />
            Actualizar
          </button>
        </header>
        <div className="admin-content">
          <div className="admin-title">
            <div>
              <p className="eyebrow">CADA DETALLE CUENTA</p>
              <h1>{viewTitle}</h1>
              <p className="muted">{viewDescription}</p>
            </div>
            {view === "products" && (
              <button
                className="primary"
                onClick={() => setEditor(freshProduct())}
              >
                <Plus size={18} />
                Agregar producto
              </button>
            )}
          </div>
          {error && <Notice error>{error}</Notice>}
          {success && (
            <Notice>
              {success}
              <button className="text-button" onClick={() => setSuccess("")}>
                Cerrar
              </button>
            </Notice>
          )}
          {view === "products" && <div className="stats">
            <div>
              <span>Productos</span>
              <strong>
                {products.length}
                <Package size={22} />
              </strong>
              <small>En tu colección</small>
            </div>
            <div>
              <span>Piezas disponibles</span>
              <strong>{products.reduce((s, p) => s + totalStock(p), 0)}</strong>
              <small>Sumando todas las variantes</small>
            </div>
            <div>
              <span>Publicados</span>
              <strong>{products.filter((p) => p.published).length}</strong>
              <small>Visibles en el catálogo</small>
            </div>
            <div className="stat-accent">
              <span>Sin existencias</span>
              <strong>
                {products.filter((p) => totalStock(p) === 0).length}
              </strong>
              <small>Productos por reponer</small>
            </div>
          </div>}
          {view === "products" ? (
            <section className="inventory-panel">
              <div className="inventory-tools">
                <label className="search-field">
                  <Search size={18} />
                  <input
                    placeholder="Buscar nombre o escanear código…"
                    aria-label="Buscar inventario"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Barcode size={20} />
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Filtrar categoría"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={publication}
                  onChange={(e) => setPublication(e.target.value)}
                  aria-label="Filtrar publicación"
                >
                  <option value="">Todos los estados</option>
                  <option value="published">Publicados</option>
                  <option value="draft">Borradores</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th>Precio</th>
                      <th>Existencias</th>
                      <th>Estado</th>
                      <th>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="table-product">
                            <div className="table-photo">
                              <ProductImage
                                url={p.photos[0]?.url}
                                name={p.name}
                              />
                            </div>
                            <div>
                              <strong>{p.name}</strong>
                              <small>
                                {p.variants[0]?.sku} · {p.variants.length}{" "}
                                {p.variants.length === 1
                                  ? "variante"
                                  : "variantes"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{categoryName(p.category_id)}</td>
                        <td>
                          {money(
                            Math.min(...p.variants.map((v) => Number(v.price))),
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              totalStock(p) === 0
                                ? "stock-count empty-stock"
                                : "stock-count"
                            }
                          >
                            {totalStock(p)} piezas
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              p.published ? "status published" : "status"
                            }
                          >
                            {p.published ? "Publicado" : "Borrador"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Ajustar inventario de ${p.name}`}
                              title="Entrada / salida"
                              onClick={() => setStock(p)}
                            >
                              <ArrowDownUp size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Editar ${p.name}`}
                              title="Editar producto"
                              onClick={() => setEditor(structuredClone(p))}
                            >
                              <Pencil size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className="empty">
                  <h2>
                    {loading
                      ? "Cargando tu colección…"
                      : "Todavía no hay piezas aquí."}
                  </h2>
                  <p>Agrega un producto o prueba otra búsqueda.</p>
                </div>
              )}
              <div className="table-footer">
                {filtered.length} productos · Los códigos de barras conservan
                los ceros iniciales.
              </div>
            </section>
          ) : view === "history" ? (
            <section className="inventory-panel">
              <div className="panel-heading">
                <h2>Últimos 100 movimientos</h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto / variante</th>
                      <th>Cantidad</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((m) => {
                      const p = products.find((p) =>
                        p.variants.some((v) => v.id === m.variant_id),
                      );
                      const v = p?.variants.find((v) => v.id === m.variant_id);
                      return (
                        <tr key={m.id}>
                          <td>
                            {new Date(m.created_at).toLocaleString("es-MX")}
                          </td>
                          <td>
                            {p?.name}
                            <small className="block muted">
                              {v ? variantLabel(v) : m.variant_id}
                            </small>
                          </td>
                          <td className={m.delta > 0 ? "positive" : "negative"}>
                            {m.delta > 0 ? "+" : ""}
                            {m.delta}
                          </td>
                          <td>{m.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!logs.length && (
                <div className="empty">
                  <h2>Tu historial empieza aquí.</h2>
                  <p>Las entradas y salidas aparecerán en esta pantalla.</p>
                </div>
              )}
            </section>
          ) : promotionSlot ? (
            promotions.find((promotion) => promotion.slot === promotionSlot) ? (
              <PromotionEditor
                key={`${promotionSlot}-${promotions.find((promotion) => promotion.slot === promotionSlot)!.revision}`}
                initial={promotions.find((promotion) => promotion.slot === promotionSlot)!}
                onSaved={async () => {
                  setSuccess(
                    isDemo
                      ? "Promoción guardada en la demostración temporal."
                      : "Promoción guardada en la nube.",
                  );
                  await refresh();
                }}
              />
            ) : (
              <div className="empty">
                <h2>{loading ? "Cargando promoción…" : "Panel no disponible"}</h2>
                <p>Actualiza la página o verifica que la migración esté aplicada.</p>
              </div>
            )
          ) : null}
          <p className="admin-footnote">
            {isDemo
              ? "Esta muestra no guarda datos al cerrar o recargar."
              : "La información se consulta al abrir, al volver a la ventana y cada 30 segundos."}
          </p>
        </div>
      </main>
      {editor && (
        <Editor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => void saved()}
        />
      )}
      {stock && (
        <StockDialog
          product={stock}
          onClose={() => setStock(null)}
          onSaved={() => {
            setStock(null);
            setSuccess("Movimiento registrado.");
            void refresh();
          }}
        />
      )}
    </div>
  );
}
interface SelectedPromotionImage {
  file: File;
  info: ImageInfo;
  url: string;
  warning: string;
}

function PromotionEditor({
  initial,
  onSaved,
}: {
  initial: Promotion;
  onSaved: () => Promise<void>;
}) {
  const [promotion, setPromotion] = useState(() => structuredClone(initial));
  const [verticalFile, setVerticalFile] =
    useState<SelectedPromotionImage | null>(null);
  const [horizontalFile, setHorizontalFile] =
    useState<SelectedPromotionImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (verticalFile) URL.revokeObjectURL(verticalFile.url);
    },
    [verticalFile],
  );
  useEffect(
    () => () => {
      if (horizontalFile) URL.revokeObjectURL(horizontalFile.url);
    },
    [horizontalFile],
  );

  async function chooseImage(
    kind: "vertical" | "horizontal",
    file: File | undefined,
  ) {
    if (!file) return;
    setError("");
    try {
      const info = await inspectImageFile(file);
      const selected = {
        file,
        info,
        url: URL.createObjectURL(file),
        warning:
          kind === "vertical"
            ? dimensionsNotice(info, 600, 1800)
            : dimensionsNotice(info, 1200, 600),
      };
      if (kind === "vertical") setVerticalFile(selected);
      else setHorizontalFile(selected);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  function removeImage(kind: "vertical" | "horizontal") {
    const label = kind === "vertical" ? "vertical" : "horizontal";
    if (!confirm(`¿Eliminar la imagen ${label}? El cambio se aplicará al guardar.`))
      return;
    if (kind === "vertical") {
      setVerticalFile(null);
      setPromotion((current) => ({
        ...current,
        vertical_path: null,
        vertical_url: undefined,
        active: false,
      }));
    } else {
      setHorizontalFile(null);
      setPromotion((current) => ({
        ...current,
        horizontal_path: null,
        horizontal_url: undefined,
      }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const uploadedPaths: string[] = [];
    let committed = false;
    try {
      const hasVertical = Boolean(verticalFile || promotion.vertical_path);
      if (promotion.active && !hasVertical)
        throw new Error("Agrega una imagen vertical antes de activar el panel.");
      if (promotion.active && !promotion.alt_text.trim())
        throw new Error("Agrega texto alternativo antes de activar el panel.");

      const next = structuredClone(promotion);
      if (verticalFile) {
        const uploaded = await uploadPromotionImage(
          promotion.slot,
          "vertical",
          verticalFile.file,
        );
        uploadedPaths.push(uploaded.path);
        next.vertical_path = uploaded.path;
        next.vertical_url = uploaded.url;
      }
      if (horizontalFile) {
        const uploaded = await uploadPromotionImage(
          promotion.slot,
          "horizontal",
          horizontalFile.file,
        );
        uploadedPaths.push(uploaded.path);
        next.horizontal_path = uploaded.path;
        next.horizontal_url = uploaded.url;
      }

      await savePromotion(next);
      committed = true;
      const obsoletePaths = [initial.vertical_path, initial.horizontal_path].filter(
        (path): path is string =>
          Boolean(path) && path !== next.vertical_path && path !== next.horizontal_path,
      );
      try {
        await removePromotionImages(obsoletePaths);
      } catch (cleanupError) {
        console.warn("La promoción se guardó, pero quedó un archivo por limpiar.", cleanupError);
      }
      await onSaved();
    } catch (cause) {
      if (!committed) {
        try {
          await removePromotionImages(uploadedPaths);
        } catch (cleanupError) {
          console.warn("No se pudo revertir una carga incompleta.", cleanupError);
        }
      }
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  const verticalPreview = verticalFile?.url || promotion.vertical_url;
  const horizontalPreview = horizontalFile?.url || promotion.horizontal_url;
  const side = promotion.slot === "left" ? "izquierdo" : "derecho";

  return (
    <form className="promotion-editor" onSubmit={submit}>
      <fieldset disabled={busy} className="editor-fieldset">
        <section className="promotion-form-card">
          <div className="form-grid">
            <label>
              Nombre interno de la promoción
              <input
                required
                maxLength={160}
                value={promotion.name}
                onChange={(event) =>
                  setPromotion((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={`Ej. Campaña de otoño — panel ${side}`}
              />
            </label>
            <label>
              Texto alternativo para accesibilidad
              <input
                required={promotion.active}
                maxLength={500}
                value={promotion.alt_text}
                onChange={(event) =>
                  setPromotion((current) => ({
                    ...current,
                    alt_text: event.target.value,
                  }))
                }
                placeholder="Describe brevemente el contenido del anuncio"
              />
            </label>
          </div>

          <div className="promotion-images">
            <PromotionImageField
              kind="vertical"
              preview={verticalPreview}
              alt={promotion.alt_text}
              warning={verticalFile?.warning || ""}
              onChoose={(file) => void chooseImage("vertical", file)}
              onRemove={() => removeImage("vertical")}
            />
            <PromotionImageField
              kind="horizontal"
              preview={horizontalPreview}
              alt={promotion.alt_text}
              warning={horizontalFile?.warning || ""}
              onChoose={(file) => void chooseImage("horizontal", file)}
              onRemove={() => removeImage("horizontal")}
            />
          </div>

          <label className="publish-switch">
            <input
              type="checkbox"
              checked={promotion.active}
              onChange={(event) =>
                setPromotion((current) => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Mostrar esta promoción</strong>
              <small>
                El panel solo aparecerá si está activo y tiene una imagen vertical válida.
              </small>
            </span>
          </label>

          {error && <Notice error>{error}</Notice>}
          <footer className="form-footer">
            <span className="promotion-revision">
              Versión {promotion.revision} · Los cambios se validan contra otras sesiones.
            </span>
            <button className="primary" type="submit" disabled={busy}>
              <Check size={17} />
              {busy ? "Guardando en la nube…" : "Guardar cambios"}
            </button>
          </footer>
        </section>
      </fieldset>
    </form>
  );
}

function PromotionImageField({
  kind,
  preview,
  alt,
  warning,
  onChoose,
  onRemove,
}: {
  kind: "vertical" | "horizontal";
  preview?: string;
  alt: string;
  warning: string;
  onChoose: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const vertical = kind === "vertical";
  return (
    <section className="promotion-image-field">
      <div className="section-heading">
        <div>
          <h3>Imagen {vertical ? "vertical" : "horizontal"}</h3>
          <p>{vertical ? "Obligatoria para activar" : "Opcional, recomendada para móvil"}</p>
        </div>
      </div>
      <div className={`promotion-preview ${vertical ? "vertical" : "horizontal"}`}>
        {preview ? (
          <img src={preview} alt={alt || "Vista previa de la promoción"} />
        ) : (
          <div className="promotion-preview-empty">
            <ImagePlus size={26} />
            <span>Sin imagen</span>
          </div>
        )}
      </div>
      <label className="promotion-upload">
        Subir o reemplazar imagen {vertical ? "vertical" : "horizontal"}
        <input
          aria-label={`Subir imagen ${vertical ? "vertical" : "horizontal"}`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            onChoose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <small className="canva-size">
        Canva: {vertical ? "600 × 1800 px (1:3)" : "1200 × 600 px (2:1)"} · JPG,
        PNG o WebP · Máximo 5 MB
      </small>
      {!vertical && (
        <small className="mobile-recommendation">
          Recomendamos cargar esta versión para una mejor presentación en celulares y tablets.
        </small>
      )}
      {warning && <Notice>{warning}</Notice>}
      {preview && (
        <button type="button" className="text-button danger" onClick={onRemove}>
          <Trash2 size={15} />
          Eliminar imagen
        </button>
      )}
    </section>
  );
}

function Editor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [photoMessage, setPhotoMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const field = <K extends keyof Product>(key: K, value: Product[K]) =>
    setP((p) => ({ ...p, [key]: value }));
  const vf = (
    index: number,
    key: keyof Variant,
    value: string | number | boolean | null,
  ) =>
    setP((p) => ({
      ...p,
      variants: p.variants.map((v, i) =>
        i === index ? { ...v, [key]: value } : v,
      ),
    }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!p.variants.some((v) => v.active) && p.published)
        throw new Error("Activa al menos una variante antes de publicar.");
      const codes = p.variants.map((v) => v.sku.trim());
      if (new Set(codes).size !== codes.length)
        throw new Error("Cada variante necesita un código interno distinto.");
      const bars = p.variants.map((v) => v.barcode?.trim()).filter(Boolean);
      if (new Set(bars).size !== bars.length)
        throw new Error("No repitas el código de barras entre variantes.");
      await saveProduct(p);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reloadPhotos() {
    const products = await listProducts(true);
    const next = products.find((x) => x.id === p.id);
    if (next) setP((old) => ({ ...old, photos: next.photos }));
  }
  async function photos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    let done = 0;
    try {
      for (const f of Array.from(files)) {
        await uploadPhoto(p.id, f, p.photos.length + done);
        done++;
      }
      await reloadPhotos();
      setPhotoMessage(
        `${done} fotos guardadas en ${isDemo ? "la demostración" : "la nube"}.`,
      );
    } catch (e) {
      setError(`${done} fotos guardadas. ${errorText(e)}`);
      await reloadPhotos().catch(() => {});
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function photoAction(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reloadPhotos();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={p.id ? "Editar producto" : "Una nueva pieza"}
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            e.target instanceof HTMLInputElement &&
            e.target.type !== "submit"
          )
            e.preventDefault();
        }}
      >
        <fieldset disabled={busy} className="editor-fieldset">
          <div className="form-grid">
            <label className="span-2">
              Nombre del producto
              <input
                required
                maxLength={160}
                value={p.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="Ej. Blusa de lino Alba"
              />
            </label>
            <label>
              Categoría
              <select
                value={p.category_id}
                onChange={(e) => field("category_id", e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Género
              <select
                value={p.gender}
                onChange={(e) => field("gender", e.target.value)}
              >
                {genders.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Marca <span className="optional">opcional</span>
              <input
                maxLength={100}
                value={p.brand}
                onChange={(e) => field("brand", e.target.value)}
              />
            </label>
            <label className="span-2">
              Descripción
              <textarea
                rows={3}
                maxLength={5000}
                value={p.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Material, acabado y detalles que hacen especial esta pieza."
              />
            </label>
          </div>
          <div className="section-heading">
            <div>
              <h3>Fotografías</h3>
              <p>JPG, PNG o WebP · Hasta 5 MB por foto</p>
            </div>
            {p.id && (
              <button
                type="button"
                className="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={17} />
                Subir fotos
              </button>
            )}
          </div>
          {p.id ? (
            <>
              <input
                className="sr-only"
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => void photos(e.target.files)}
              />
              <div className="photo-editor">
                {p.photos.map((ph, i) => (
                  <div key={ph.id}>
                    <div className="edit-photo">
                      <ProductImage url={ph.url} name={`Foto ${i + 1}`} />
                    </div>
                    <div className="photo-actions">
                      <button
                        type="button"
                        className={
                          i === 0 ? "text-button positive" : "text-button"
                        }
                        aria-label={`Usar foto ${i + 1} como portada`}
                        onClick={() => void photoAction(() => coverPhoto(ph))}
                      >
                        <Star size={15} />
                        {i === 0 ? "Portada" : "Elegir"}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Eliminar foto ${i + 1}`}
                        onClick={() => {
                          if (confirm("¿Eliminar esta fotografía?"))
                            void photoAction(() => removePhoto(ph));
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!p.photos.length && (
                <p className="muted">
                  Agrega la primera fotografía de este producto.
                </p>
              )}
            </>
          ) : (
            <div className="photo-placeholder">
              <ImagePlus size={24} />
              <p>
                Guarda primero el producto. Después abre «Editar» para agregar
                sus fotos.
              </p>
            </div>
          )}
          {photoMessage && <Notice>{photoMessage}</Notice>}
          <div className="section-heading">
            <div>
              <h3>Variantes e inventario</h3>
              <p>Una variante por talla, color o presentación.</p>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={p.variants.length >= 100}
              onClick={() => field("variants", [...p.variants, freshVariant()])}
            >
              <Plus size={17} />
              Variante
            </button>
          </div>
          {p.variants.map((v, i) => (
            <section className="variant-editor" key={i}>
              <div className="variant-heading">
                <strong>
                  Variante {i + 1} <span>{variantLabel(v)}</span>
                </strong>
                {!v.id && p.variants.length > 1 ? (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Quitar variante ${i + 1}`}
                    onClick={() =>
                      field(
                        "variants",
                        p.variants.filter((_, n) => n !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={v.active}
                      onChange={(e) => vf(i, "active", e.target.checked)}
                    />
                    Activa
                  </label>
                )}
              </div>
              <div className="form-grid three">
                <label>
                  Código interno
                  <input
                    required
                    maxLength={80}
                    value={v.sku}
                    onChange={(e) => vf(i, "sku", e.target.value)}
                  />
                </label>
                <label className="span-2">
                  Código de barras
                  <input
                    maxLength={80}
                    value={v.barcode || ""}
                    onChange={(e) => vf(i, "barcode", e.target.value)}
                    placeholder="Escanéalo o escríbelo; opcional"
                  />
                </label>
                <label>
                  Talla
                  <input
                    maxLength={80}
                    value={v.size}
                    onChange={(e) => vf(i, "size", e.target.value)}
                    placeholder="CH, M, 24…"
                  />
                </label>
                <label>
                  Color
                  <input
                    maxLength={80}
                    value={v.color}
                    onChange={(e) => vf(i, "color", e.target.value)}
                    placeholder="Marfil"
                  />
                </label>
                <label>
                  Presentación
                  <input
                    maxLength={80}
                    value={v.presentation}
                    onChange={(e) => vf(i, "presentation", e.target.value)}
                    placeholder="50 ml, única…"
                  />
                </label>
                <label>
                  Precio de venta (MXN)
                  <input
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    required
                    value={v.price}
                    onChange={(e) => vf(i, "price", Number(e.target.value))}
                  />
                </label>
                <label>
                  Costo (privado)
                  <input
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    value={v.cost ?? ""}
                    onChange={(e) =>
                      vf(
                        i,
                        "cost",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label>
                  {v.id ? "Existencias actuales" : "Existencias iniciales"}
                  <input
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    required
                    readOnly={Boolean(v.id)}
                    value={v.stock}
                    onChange={(e) => vf(i, "stock", Number(e.target.value))}
                  />
                </label>
              </div>
              {v.id && (
                <small className="muted">
                  Registra entradas y salidas desde el botón de inventario en la
                  tabla.
                </small>
              )}
            </section>
          ))}
          <label className="publish-switch">
            <input
              type="checkbox"
              checked={p.published}
              onChange={(e) => field("published", e.target.checked)}
            />
            <span>
              <strong>Mostrar en el catálogo</strong>
              <small>
                Desactívalo para guardar como borrador u ocultar esta pieza.
              </small>
            </span>
          </label>
          {error && <Notice error>{error}</Notice>}
          <footer className="form-footer">
            <button type="button" className="secondary" onClick={onClose}>
              Cerrar
            </button>
            <button className="primary" type="submit">
              {busy ? (
                "Guardando…"
              ) : (
                <>
                  <Check size={17} />
                  Guardar producto
                </>
              )}
            </button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
function StockDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id, setId] = useState(product.variants[0].id),
    [kind, setKind] = useState("in"),
    [quantity, setQuantity] = useState(1),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef({ key: "", id: "" });
  const v = product.variants.find((v) => v.id === id)!;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const delta = kind === "in" ? quantity : -quantity;
    const key = JSON.stringify([id, delta, note]);
    if (request.current.key !== key)
      request.current = { key, id: crypto.randomUUID() };
    try {
      await adjustStock(id, delta, note, request.current.id);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Entrada o salida de inventario"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">{product.name}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="editor-fieldset">
          <label>
            Variante
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {product.variants.map((v) => (
                <option value={v.id} key={v.id}>
                  {variantLabel(v)} · {v.sku}
                </option>
              ))}
            </select>
          </label>
          <p>
            Existencias al abrir: <strong>{v.stock} piezas</strong>
          </p>
          <div className="form-grid">
            <label>
              Movimiento
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="in">Entrada (+)</option>
                <option value="out">Salida (−)</option>
              </select>
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </label>
            <label className="span-2">
              Motivo
              <input
                required
                maxLength={500}
                placeholder="Compra, venta, devolución, ajuste…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          {error && <Notice error>{error}</Notice>}
          <footer className="form-footer">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Guardando…" : "Registrar movimiento"}
            </button>
          </footer>
        </fieldset>
      </form>
    </Modal>
  );
}
