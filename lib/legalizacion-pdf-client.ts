import type { FacturaPdf } from "@/components/pdf/legalizacion-pdf";
import {
  extractIdsFromReporteFacturasCell,
  facturaRowToFacturaPdfForLegalizacion,
  parseFacturasJsonFromSheetCell,
  parseFacturasPdfFromReporteCell,
} from "@/lib/legalizacion-factura-pdf-map";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

/**
 * Generación en el navegador del PDF de legalización (acta). La usan la firma del administrador y
 * la ventana de Form Finance, que puede volver a generarla con otro monto asignado.
 */

type ReporteRow = Record<string, string>;
type FacturaRow = Record<string, unknown>;

function urlParaProxyFactura(f: FacturaPdf): string | null {
  const u = f.imagenUrl?.trim();
  if (u?.startsWith("data:")) return null;
  // Cualquier URL http(s) se baja por el proxy para poder recomprimirla antes
  // de incrustarla en el PDF (Supabase, Drive, googleusercontent, etc.). El
  // proxy valida el host permitido; si no lo permite, responde 403 y se
  // conserva la imagen original tal cual.
  if (u && (u.startsWith("http://") || u.startsWith("https://"))) return u;
  const id = f.driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?id=${id}`;
  return null;
}

/**
 * Recomprime una data URL para que el PDF final no exceda el límite de
 * Supabase Storage (~50 MB). Compresión moderada: se mantiene resolución
 * suficiente para leer el número de factura y el NIT (privilegiamos
 * resolución, que es lo que afecta al texto pequeño) y se baja sobre todo
 * la calidad JPEG (que afecta menos a la legibilidad del texto).
 */
async function compressDataUrlImage(
  dataUrl: string,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<string> {
  const maxDim = opts.maxDim ?? 2000;
  const quality = opts.quality ?? 0.72;
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  // PDFs convertidos a imagen por el proxy ya vienen como image/*; los dejamos.
  return new Promise<string>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function resolveFacturaImages(facturas: FacturaPdf[]): Promise<FacturaPdf[]> {
  return Promise.all(
    facturas.map(async (f) => {
      const target = urlParaProxyFactura(f);
      let dataUrl = f.imagenUrl?.startsWith("data:image/") ? f.imagenUrl : "";
      if (!dataUrl && target) {
        try {
          const res = await fetch(`/api/proxy-imagen-base64?url=${encodeURIComponent(target)}`);
          if (res.ok) {
            const j = (await res.json()) as { dataUrl?: string };
            // Solo recomprimimos imágenes; si no lo es, se conserva f tal cual.
            if (j.dataUrl?.startsWith("data:image/")) dataUrl = j.dataUrl;
          }
        } catch {
          /* mantener f tal cual */
        }
      }
      if (!dataUrl) return f;
      const compressed = await compressDataUrlImage(dataUrl);
      return { ...f, imagenUrl: compressed };
    })
  );
}

/** Facturas del reporte tal como se guardaron; si solo hay ids, se buscan en `facturasLocales`. */
export function facturasDelReporteLocal(rep: ReporteRow, facturasLocales: FacturaRow[]): FacturaPdf[] {
  const raw = String(rep.Facturas_IDs || rep.FacturasIds || "");
  const parsed = parseFacturasPdfFromReporteCell(raw);
  if (parsed?.length && typeof parsed[0] === "object") {
    return parsed as FacturaPdf[];
  }
  const ids = new Set(extractIdsFromReporteFacturasCell(raw));
  return facturasLocales
    .filter((f) => ids.has(String(getCellCaseInsensitive(f, "ID_Factura", "ID"))))
    .map((f) => facturaRowToFacturaPdfForLegalizacion(f, { area: "—" }));
}

async function facturasPdfDelReporte(activo: ReporteRow, facturasLocales: FacturaRow[]): Promise<FacturaPdf[]> {
  const rawFacturas = String(activo.Facturas_IDs || activo.FacturasIds || "[]").trim();
  try {
    const parsedUnknown = parseFacturasJsonFromSheetCell(rawFacturas || "[]");
    if (parsedUnknown === null || !Array.isArray(parsedUnknown) || parsedUnknown.length === 0) {
      return facturasDelReporteLocal(activo, facturasLocales);
    }
    if (typeof parsedUnknown[0] === "string") {
      const responses = await Promise.all(
        (parsedUnknown as string[]).map((id) =>
          fetch(`/api/facturas/${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .catch(() => null)
        )
      );
      const rows = responses
        .map((r) =>
          r && typeof r === "object" && r !== null && "data" in r ? (r as { data: FacturaRow }).data : null
        )
        .filter(Boolean) as FacturaRow[];
      const desdeApi = rows.map((f) => facturaRowToFacturaPdfForLegalizacion(f, { area: "—" }));
      return desdeApi.length ? desdeApi : facturasDelReporteLocal(activo, facturasLocales);
    }
    if (typeof parsedUnknown[0] === "object" && parsedUnknown[0] !== null) {
      return (parsedUnknown as FacturaRow[]).map((row) => facturaRowToFacturaPdfForLegalizacion(row, { area: "—" }));
    }
    return facturasDelReporteLocal(activo, facturasLocales);
  } catch (e) {
    console.error("[legalizacion pdf] Error parseando facturas:", e);
    return facturasDelReporteLocal(activo, facturasLocales);
  }
}

/** Renderiza el PDF del acta con el monto asignado (`limite`) indicado. Devuelve el archivo. */
export async function generarPdfLegalizacion({
  reporte,
  limite,
  firmaAdmin,
  sectorPorDefecto = "Bogota",
  facturasLocales = [],
  fechaGeneracion = new Date().toLocaleDateString("es-CO"),
  onEtapa,
}: {
  reporte: ReporteRow;
  /** Monto asignado de la caja menor que se imprime en el PDF. */
  limite: number;
  firmaAdmin: string;
  sectorPorDefecto?: string;
  facturasLocales?: FacturaRow[];
  fechaGeneracion?: string;
  /** Avisa en qué paso va (para mostrar dónde falló si algo sale mal). */
  onEtapa?: (etapa: string) => void;
}): Promise<Blob> {
  const sectorRep = String(reporte.Sector || sectorPorDefecto);
  const coordNombre = String(reporte.Coordinador || "");
  let coordCargo = "Field Ops Planner";
  let coordCedula = "";
  let coordArea = "";
  try {
    const uRes = await fetch(`/api/usuarios?responsable=${encodeURIComponent(coordNombre.trim())}`);
    const uJson = (await uRes.json().catch(() => ({}))) as { data?: Record<string, unknown>[] };
    const uRow = Array.isArray(uJson.data) ? uJson.data[0] : undefined;
    if (uRow) {
      coordCargo = String(getCellCaseInsensitive(uRow, "Cargo") || coordCargo);
      coordCedula = String(getCellCaseInsensitive(uRow, "Cedula", "Cédula", "Documento") || "");
      coordArea = String(getCellCaseInsensitive(uRow, "Area", "Área") || "");
    }
  } catch {
    /* defaults */
  }
  const firmaCoord = String(reporte.Firma_Coordinador || reporte.FirmaCoordinador || "");
  const facturasPdf = await facturasPdfDelReporte(reporte, facturasLocales);

  onEtapa?.("resolviendo imágenes");
  const facturasConImagenes = await resolveFacturaImages(facturasPdf);

  onEtapa?.("cargando módulo PDF");
  const [{ pdf }, { LegalizacionPdf }, { createElement }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/legalizacion-pdf"),
    import("react"),
  ]);

  onEtapa?.("renderizando PDF");
  const doc = createElement(LegalizacionPdf, {
    coordinador: {
      responsable: coordNombre,
      cargo: coordCargo,
      cedula: coordCedula,
      sector: sectorRep,
      area: coordArea,
    },
    facturas: facturasConImagenes,
    firmaCoordinador: firmaCoord,
    firmaAdmin,
    fechaGeneracion,
    limiteZona: limite,
  });
  // LegalizacionPdf devuelve un <Document>; createElement no lo sabe, de ahí el cast
  return pdf(doc as unknown as Parameters<typeof pdf>[0]).toBlob();
}
