import type { LucideIcon } from "lucide-react";

/** Etiqueta de una métrica: ícono de línea + texto, en lugar de emojis (trazo más limpio). */
export function MetricLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
      {children}
    </p>
  );
}
