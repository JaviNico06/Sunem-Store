import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Image as ImageIcon } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function ProductImage({
  url,
  name,
  className = "",
}: {
  url?: string;
  name: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return url && failedUrl !== url ? (
    <img
      src={url}
      alt={name}
      className={className}
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  ) : (
    <div className={"no-photo " + className}>
      <ImageIcon size={30} />
      <span>{url ? "Fotografía no disponible" : "Sin fotografía"}</span>
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "notice error" : "notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
