"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Pinta el contenido directamente en <body>. Las tarjetas de cristal usan `backdrop-filter`,
 * que convierte a la tarjeta en el bloque contenedor de todo lo `fixed` que lleve dentro
 * (modales, botones flotantes): sin el portal quedarían recortados o fuera de lugar.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [destino, setDestino] = useState<HTMLElement | null>(null);
  useEffect(() => setDestino(document.body), []);
  return destino ? createPortal(children, destino) : null;
}
