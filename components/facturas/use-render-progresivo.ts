"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

/**
 * Pinta una lista larga por tandas. Con miles de filas a la vez el navegador se congela
 * (en pruebas con 3.000 facturas: 44 s para mostrar la lista y 10 s por cada movimiento del mouse).
 * Siguiente tanda: al acercarse al final con el scroll, o con el botón «Mostrar más».
 */
export function useRenderProgresivo<T>(items: T[], tanda = 40) {
  const [limite, setLimite] = useState(tanda);
  const centinela = useRef<HTMLDivElement | null>(null);
  const hayMas = items.length > limite;

  // En transición: React pinta la tanda sin bloquear el scroll ni los clics
  const verMas = useCallback(() => startTransition(() => setLimite((l) => l + tanda)), [tanda]);
  const reiniciar = useCallback(() => setLimite(tanda), [tanda]);

  useEffect(() => {
    const el = centinela.current;
    if (!el || !hayMas || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && verMas(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
    // `limite` en las dependencias: tras cada tanda se vuelve a observar, por si el final sigue a la vista
  }, [hayMas, limite, verMas]);

  return { visibles: items.slice(0, limite), hayMas, centinela, verMas, reiniciar };
}
