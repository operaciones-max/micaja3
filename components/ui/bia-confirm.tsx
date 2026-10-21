"use client";

type Props = {
  mensaje: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Texto del botón de acción (p. ej. "Eliminar"). */
  confirmLabel?: string;
  variant?: "danger" | "default";
};

export function BiaConfirm({
  mensaje,
  onConfirmar,
  onCancelar,
  confirmLabel = "Confirmar",
  variant = "danger",
}: Props) {
  const confirmCls =
    variant === "danger"
      ? "rounded-full border border-red-500/30 bg-red-500/15 px-5 py-2 text-sm font-semibold text-danger hover:bg-red-500/25"
      : "rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90";

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onCancelar}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm glass-strong p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-6 text-sm text-foreground">{mensaje}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-full bg-muted px-5 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} className={confirmCls}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
