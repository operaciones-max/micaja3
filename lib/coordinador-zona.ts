/** Tope único de caja menor (COP). Bogotá y Costa Caribe comparten la misma caja. */
export const LIMITE_CAJA_MENOR = 3_000_000;

/** Límite de total a aprobar por reporte (COP). Es el mismo para todas las zonas. */
export function limiteAprobacionZona(sector?: string): number {
  void sector;
  return LIMITE_CAJA_MENOR;
}

export function etiquetaZona(sector: string): string {
  const s = sector.toLowerCase();
  if (s.includes("bogota")) return "Bogotá";
  if (s.includes("costa")) return "Costa Caribe";
  return sector || "Zona";
}
