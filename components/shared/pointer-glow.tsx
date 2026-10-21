"use client";

import { useEffect } from "react";

/** Reflejo especular del cristal: el brillo de cualquier `.glass` sigue al cursor (solo con mouse). */
export function PointerGlow() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    let el: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = (e.target as HTMLElement | null)?.closest?.(".glass:not([data-sin-brillo]), .glass-strong:not([data-sin-brillo])") as HTMLElement | null;
      if (!target) return;
      el = target;
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${x - r.left}px`);
        el.style.setProperty("--my", `${y - r.top}px`);
      });
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
