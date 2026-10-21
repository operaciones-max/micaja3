"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFxUrl } from "@/lib/fx-form-config";
import { CheckCircle2, Download, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { LIMITE_CAJA_MENOR } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString } from "@/lib/format";

function pdfPreviewUrl(url: string): string {
  const u = url.trim();
  const driveFile = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFile?.[1]) {
    return `https://drive.google.com/file/d/${driveFile[1]}/preview`;
  }
  return u;
}

export interface FxReporte {
  ID_Reporte?: string;
  ID?: string;
  Fecha?: string;
  Coordinador?: string;
  Sector?: string;
  Periodo_Desde?: string;
  Periodo_Hasta?: string;
  Total?: string | number;
  Estado?: string;
  PDF_URL?: string;
  Fecha_ISO?: string;
  Firma_Admin?: string;
}

interface EnviarFxModalProps {
  reporte: FxReporte | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (reporteId: string) => void;
}

export default function EnviarFxModal({ reporte, open, onClose, onSuccess }: EnviarFxModalProps) {
  const { data: session } = useSession();
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState({
    empresa: "Bia Energy S.A.S E.S.P",
    nombres: "",
    identificacion: "",
    cargo: "",
    correo: "",
    tipoSolicitud: "Legalización caja menor",
    descripcion: "Legalización gastos",
    departamento: "General Ops",
  });

  // Monto asignado que se imprime en el acta (por defecto, el de la caja menor) y versión regenerada
  const [monto, setMonto] = useState(String(LIMITE_CAJA_MENOR));
  const [generando, setGenerando] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");
  const [pdfNuevo, setPdfNuevo] = useState<{ url: string; monto: number } | null>(null);
  const pdfNuevoRef = useRef<string | null>(null);

  function soltarPdfNuevo() {
    if (pdfNuevoRef.current) URL.revokeObjectURL(pdfNuevoRef.current);
    pdfNuevoRef.current = null;
    setPdfNuevo(null);
  }

  useEffect(() => {
    if (!open) {
      setEnviado(false);
      soltarPdfNuevo();
      setErrorPdf("");
      setMonto(String(LIMITE_CAJA_MENOR));
    }
  }, [open]);

  // Al cambiar de reporte se descarta la versión regenerada del anterior
  const idActual = String(reporte?.ID_Reporte || reporte?.ID || "");
  useEffect(() => {
    soltarPdfNuevo();
    setErrorPdf("");
  }, [idActual]);

  useEffect(() => () => {
    if (pdfNuevoRef.current) URL.revokeObjectURL(pdfNuevoRef.current);
  }, []);

  useEffect(() => {
    if (session?.user) {
      setCampos((prev) => ({
        ...prev,
        nombres: session.user.responsable || prev.nombres,
        identificacion: session.user.cedula || prev.identificacion,
        cargo: session.user.cargo || prev.cargo,
        correo: session.user.email || prev.correo,
      }));
    }
  }, [session]);

  useEffect(() => {
    if (!open || !reporte) return;
    const desde = String(reporte.Periodo_Desde || "").trim();
    const hasta = String(reporte.Periodo_Hasta || "").trim();
    const totalRaw = reporte.Total;
    const totalNum =
      typeof totalRaw === "number" ? totalRaw : parseCOPString(String(totalRaw ?? ""));
    const periodo = desde && hasta ? `${desde} → ${hasta}` : desde || hasta || "";
    const descripcion =
      periodo || totalNum
        ? `Legalización caja menor${periodo ? ` · ${periodo}` : ""}${totalNum ? ` · Total ${formatCOP(totalNum)}` : ""}`
        : "Legalización gastos";
    setCampos((prev) => ({ ...prev, descripcion }));
  }, [open, reporte]);

  const pdfUrl = String(reporte?.PDF_URL || "").trim();
  const hayPdf = Boolean(pdfNuevo || pdfUrl);
  const previewSrc = pdfNuevo ? pdfNuevo.url : pdfUrl ? pdfPreviewUrl(pdfUrl) : "";
  const montoNum = Number(monto.replace(/\D/g, "")) || 0;
  const fxUrl = useMemo(() => buildFxUrl(campos), [campos]);
  const reporteId = String(reporte?.ID_Reporte || reporte?.ID || "").trim();

  if (!reporte) return null;

  /** Vuelve a generar el acta en el navegador con otro monto asignado (mismas facturas y firmas). */
  const regenerarPdf = async () => {
    if (!montoNum) {
      setErrorPdf("Escribe un monto asignado válido.");
      return;
    }
    setGenerando(true);
    setErrorPdf("");
    try {
      const fila = reporte as unknown as Record<string, string>;
      const creado = new Date(String(fila.Fecha_ISO || ""));
      const { generarPdfLegalizacion } = await import("@/lib/legalizacion-pdf-client");
      const blob = await generarPdfLegalizacion({
        reporte: fila,
        limite: montoNum,
        firmaAdmin: String(fila.Firma_Admin || fila.FirmaAdmin || ""),
        sectorPorDefecto: String(session?.user?.sector || "Bogota"),
        // Se conserva la fecha del reporte, no la de hoy
        fechaGeneracion: Number.isNaN(creado.getTime()) ? undefined : creado.toLocaleDateString("es-CO"),
      });
      soltarPdfNuevo();
      const url = URL.createObjectURL(blob);
      pdfNuevoRef.current = url;
      setPdfNuevo({ url, monto: montoNum });
    } catch (e) {
      console.error("[form finance] no se pudo regenerar el PDF:", e);
      setErrorPdf("No se pudo generar el acta de nuevo. Inténtalo otra vez.");
    } finally {
      setGenerando(false);
    }
  };

  const nombreArchivo = `Legalizacion_${String(reporte.Coordinador || "reporte").trim().replace(/\s+/g, "_")}_${reporteId || "acta"}.pdf`;

  const handleAbrirFormulario = () => {
    window.open(fxUrl, "_blank", "noopener,noreferrer");
  };

  const handleMarcarEnviado = async () => {
    if (!reporteId) {
      window.alert("❌ Reporte sin ID");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(reporteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Enviado FX" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(`❌ ${j.error || "No se pudo actualizar el estado"}`);
        return;
      }
      setEnviado(true);
      onSuccess(reporteId);
    } catch {
      window.alert("❌ Error de red al actualizar estado");
    } finally {
      setLoading(false);
    }
  };

  const campo = "mt-1 border-border bg-foreground/5 text-foreground";
  const campoFijo = "mt-1 cursor-not-allowed border-border bg-foreground/5 text-foreground/60";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] w-[96vw] max-w-6xl overflow-y-auto p-4 text-[15px] text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 text-lg font-semibold">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            Form Finance — Legalización
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Reporte {reporteId || "—"} · {reporte.Periodo_Desde || "—"} → {reporte.Periodo_Hasta || "—"}
          </p>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Izquierda: el PDF firmado, a todo lo alto */}
          <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-foreground/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              PDF del reporte (ya firmado)
            </p>
            {hayPdf ? (
              <>
                {/* Alto definido + iframe absoluto: no depende de porcentajes ni de flex, que Safari resuelve distinto */}
                <div className="relative mb-3 h-[clamp(340px,52vh,480px)] min-h-[340px] w-full overflow-hidden rounded-xl border border-border bg-white lg:h-[clamp(380px,calc(94vh-440px),620px)] lg:min-h-[380px]">
                  <iframe
                    key={previewSrc}
                    title="Vista previa PDF"
                    src={previewSrc}
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </>
            ) : (
              <p className="mb-3 text-sm text-danger">⚠️ No se encontró PDF para este reporte.</p>
            )}

            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <div className="min-w-0">
                <Label htmlFor="fx-monto" className="text-xs text-muted-foreground">
                  Monto asignado en el acta
                </Label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="fx-monto"
                    inputMode="numeric"
                    value={montoNum ? montoNum.toLocaleString("es-CO") : ""}
                    onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-40 border-border bg-foreground/5 pl-7 tabular-nums text-foreground"
                    placeholder="3.000.000"
                  />
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => void regenerarPdf()} disabled={generando || !montoNum} className="gap-2">
                {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {generando ? "Generando…" : "Actualizar PDF"}
              </Button>
              {hayPdf ? (
                <a
                  href={pdfNuevo ? pdfNuevo.url : pdfUrl}
                  {...(pdfNuevo ? { download: nombreArchivo } : { target: "_blank", rel: "noopener noreferrer" })}
                  className="ml-auto shrink-0"
                >
                  <Button size="sm" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </Button>
                </a>
              ) : null}
            </div>
            {errorPdf ? <p className="mt-2 text-xs text-danger">{errorPdf}</p> : null}
            {pdfNuevo ? (
              <p className="mt-2 text-xs text-success">
                ✓ Acta actualizada con monto asignado {formatCOP(pdfNuevo.monto)}. Descárgala para adjuntarla en el formulario.
              </p>
            ) : hayPdf ? (
              <p className="mt-2 text-xs text-muted-foreground">
                ¿El acta muestra otro monto asignado? Ajústalo y pulsa «Actualizar PDF»: se genera de nuevo con las mismas facturas y firmas. Esta versión se descarga desde aquí; no reemplaza la guardada. ¿No ves el acta? Ábrela con «Descargar PDF».
              </p>
            ) : null}
            <p className="mt-2 text-xs text-warning">
              ⚠️ Descarga el PDF antes de abrir el formulario; se adjunta manualmente en Google Forms.
            </p>
          </section>

          {/* Derecha: datos del formulario y pasos */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className="rounded-2xl border border-border bg-foreground/5 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Datos del formulario FX (editables)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input
                    value={campos.empresa}
                    onChange={(e) => setCampos((p) => ({ ...p, empresa: e.target.value }))}
                    className={campo}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Nombres y apellidos</Label>
                  <Input
                    value={campos.nombres}
                    onChange={(e) => setCampos((p) => ({ ...p, nombres: e.target.value }))}
                    className={campo}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">No. identificación (cédula)</Label>
                  <Input
                    value={campos.identificacion}
                    onChange={(e) => setCampos((p) => ({ ...p, identificacion: e.target.value }))}
                    className={campo}
                    placeholder="Sin cédula en perfil — ingresar"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Cargo</Label>
                  <Input
                    value={campos.cargo}
                    onChange={(e) => setCampos((p) => ({ ...p, cargo: e.target.value }))}
                    className={campo}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Correo corporativo</Label>
                  <Input
                    value={campos.correo}
                    onChange={(e) => setCampos((p) => ({ ...p, correo: e.target.value }))}
                    className={campo}
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de solicitud</Label>
                  <Input value={campos.tipoSolicitud} readOnly className={campoFijo} />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Departamento origen del costo/gasto</Label>
                  <Input value={campos.departamento} readOnly className={campoFijo} />
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Breve descripción</Label>
                  <Input value={campos.descripcion} readOnly className={campoFijo} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-foreground/5 p-4 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pasos para enviar
              </p>
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground marker:font-semibold marker:text-foreground">
                <li>Descarga el PDF firmado</li>
                <li>Haz clic en Abrir Form Finance (campos de texto prellenados)</li>
                <li>Adjunta el PDF descargado</li>
                <li>Envía el formulario en Google Forms</li>
                <li>Regresa y marca como Enviado</li>
              </ol>
            </section>
          </div>
        </div>

        <DialogFooter className="sticky -bottom-4 z-10 flex flex-wrap gap-2 bg-popover sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
          {!enviado ? (
            <>
              <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleAbrirFormulario} disabled={!hayPdf} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Abrir Form Finance
              </Button>
              <Button onClick={handleMarcarEnviado} disabled={loading} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {loading ? "Guardando..." : "Marcar como Enviado"}
              </Button>
            </>
          ) : (
            <div className="w-full text-center font-semibold text-success">
              ✅ ¡Reporte marcado como Enviado!
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
