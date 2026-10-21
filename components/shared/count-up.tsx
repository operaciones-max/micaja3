"use client";

import { useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";

/** Número que sube hasta su cifra (y se reajusta si el valor cambia). Respeta "reducir movimiento". */
export function CountUp({
  value,
  format = formatCOP,
  duration = 1100,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    const end = value;
    if (start === end || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = end;
      setShown(end);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      const v = Math.round(start + (end - start) * eased);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{format(shown)}</span>;
}
