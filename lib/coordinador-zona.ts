import { normalizeSector, sectorsEquivalent } from "@/lib/sector-normalize";

/** Tope único de caja menor (COP). Bogotá y Costa Caribe comparten la misma caja. */
export const LIMITE_CAJA_MENOR = 3_000_000;

/** Límite de total a aprobar por reporte (COP). Es el mismo para todas las zonas. */
export function limiteAprobacionZona(sector?: string): number {
  void sector;
  return LIMITE_CAJA_MENOR;
}

/** Valor especial de zona: Bogotá y Costa Caribe juntas. */
export const ZONA_TODAS = "Todas";

/**
 * Coordinadores que operan sobre las dos zonas: envían dinero, aprueban y legalizan
 * facturas de técnicos de Bogotá y de Costa Caribe. El resto de coordinadores sigue
 * limitado a su propia zona. Se puede ampliar con COORDINADORES_MULTIZONA
 * (correos separados por coma).
 */
const MULTIZONA_POR_DEFECTO = ["dinovi.sanchez@bia.app"];

export function esCoordinadorMultizona(email?: string | null): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (MULTIZONA_POR_DEFECTO.includes(e)) return true;
  return String(process.env.COORDINADORES_MULTIZONA ?? "")
    .split(/[,;\s]+/)
    .some((x) => x.trim().toLowerCase() === e);
}

/**
 * Coordinadores que pueden editar cualquier factura: de cualquier responsable y en cualquier
 * estado (también las aprobadas y las completadas). El resto sigue con las reglas de siempre.
 * Se puede ampliar con COORDINADORES_EDICION_TOTAL (correos separados por coma).
 */
const EDICION_TOTAL_POR_DEFECTO = ["dinovi.sanchez@bia.app"];

export function puedeEditarCualquierFactura(u: { email?: string | null; rol?: string | null }): boolean {
  if (String(u.rol ?? "").toLowerCase() !== "coordinador") return false;
  const e = String(u.email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (EDICION_TOTAL_POR_DEFECTO.includes(e)) return true;
  return String(process.env.COORDINADORES_EDICION_TOTAL ?? "")
    .split(/[,;\s]+/)
    .some((x) => x.trim().toLowerCase() === e);
}

type PersonaZona = { email?: string | null; rol?: string | null; sector?: string | null };

/**
 * Zona sobre la que opera una persona: `ZONA_TODAS` (administrador y coordinadores
 * multizona) o su propio sector.
 */
export function zonaDeOperacion(u: PersonaZona): string {
  const rol = String(u.rol ?? "").toLowerCase();
  if (rol === "admin") return ZONA_TODAS;
  if (rol === "coordinador" && esCoordinadorMultizona(u.email)) return ZONA_TODAS;
  const sector = String(u.sector ?? "").trim();
  return normalizeSector(sector) ?? sector;
}

/** ¿Puede esta persona ver u operar la zona pedida? */
export function puedeOperarZona(u: PersonaZona, zonaPedida: string): boolean {
  const propia = zonaDeOperacion(u);
  if (propia === ZONA_TODAS) return true;
  if (zonaPedida === ZONA_TODAS) return false;
  return sectorsEquivalent(propia, zonaPedida);
}

export function etiquetaZona(sector: string): string {
  if (sector === ZONA_TODAS) return "Bogotá y Costa Caribe";
  const s = sector.toLowerCase();
  if (s.includes("bogota")) return "Bogotá";
  if (s.includes("costa")) return "Costa Caribe";
  return sector || "Zona";
}
