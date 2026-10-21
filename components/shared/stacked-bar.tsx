"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type BarSegment = {
  key: string;
  label: string;
  /** Ancho en % (0–100). */
  pct: number;
  /** Texto del valor (p. ej. "$ 1.260.000") para el tooltip. */
  value: string;
  /** Clases de color del tramo. */
  className: string;
  /** Clase de color del punto de la leyenda. */
  dotClassName: string;
};

/**
 * Barra apilada: crece al aparecer con una pasada de luz, muestra el valor al pasar el cursor
 * por un tramo y permite aislar un tramo desde la leyenda.
 */
export function StackedBar({
  segments,
  size = "md",
  showPctInLegend = false,
  className,
}: {
  segments: BarSegment[];
  size?: "md" | "lg";
  showPctInLegend?: boolean;
  className?: string;
}) {
  const [grown, setGrown] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const resumen = segments.map((s) => `${s.label} ${s.pct}%`).join(", ");

  return (
    <div className={className}>
      <div ref={wrap} className="relative" role="img" aria-label={`Uso de la caja: ${resumen}`}>
        <div
          aria-hidden
          className={cn(
            "glass-strong pointer-events-none absolute bottom-full z-10 mb-3 whitespace-nowrap px-3 py-2 text-xs opacity-0 transition-[opacity,transform] duration-300 ease-[var(--spring)]",
            tip && "opacity-100"
          )}
          style={{ left: tip?.x ?? 0, borderRadius: 14, transform: `translate(-50%, ${tip ? 0 : 6}px) scale(${tip ? 1 : 0.92})` }}
        >
          {tip?.text}
        </div>

        <div
          className={cn(
            "flex gap-0.5 overflow-hidden rounded-full bg-track p-0.5 shadow-inner",
            size === "lg" ? "h-5" : "h-3.5"
          )}
        >
          {segments.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "bar-sheen relative block h-full cursor-default overflow-hidden rounded-full transition-[width,opacity,transform] duration-[1300ms] ease-[var(--ease)]",
                s.className,
                active && active !== s.key && "opacity-30",
                active === s.key && "scale-y-125"
              )}
              style={{ width: grown ? `${s.pct}%` : "0%", transitionDelay: `${i * 140}ms` }}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => {
                setActive(null);
                setTip(null);
              }}
              onPointerMove={(e) => {
                const r = wrap.current?.getBoundingClientRect();
                if (!r) return;
                setTip({
                  x: Math.max(80, Math.min(r.width - 80, e.clientX - r.left)),
                  text: `${s.label} · ${s.value} · ${s.pct}%`,
                });
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-[background-color,color,transform] duration-300 ease-[var(--spring)] hover:bg-foreground/5 hover:text-foreground active:scale-95"
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
          >
            <i className={cn("size-2 rounded-full", s.dotClassName)} />
            {s.label}
            {showPctInLegend ? ` (${s.pct}%)` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
