"use client";

type AlertType = "success" | "error" | "warning" | "info";

const styles: Record<AlertType, string> = {
  success: "bg-success/10 border-success/30 text-success",
  error: "bg-red-500/10 border-red-500/30 text-danger",
  warning: "bg-yellow-500/10 border-yellow-500/30 text-warning",
  info: "bg-foreground/5 border-foreground/15 text-foreground",
};

const icons: Record<AlertType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function BiaAlert({ type, message }: { type: AlertType; message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`rise flex items-center gap-3 rounded-[22px] border px-4 py-3 text-sm backdrop-blur-xl ${styles[type]}`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-xs font-bold" aria-hidden>
        {icons[type]}
      </span>
      <span>{message}</span>
    </div>
  );
}
