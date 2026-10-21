"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFxUrl } from "@/lib/fx-form-config";
import { CheckCircle2, Download, ExternalLink, FileText } from "lucide-react";
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

  useEffect(() => {
    if (!open) {
      setEnviado(false);
    }
  }, [open]);

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
  const previewSrc = pdfUrl ? pdfPreviewUrl(pdfUrl) : "";
  const fxUrl = useMemo(() => buildFxUrl(campos), [campos]);
  const reporteId = String(reporte?.ID_Reporte || reporte?.ID || "").trim();

  if (!reporte) return null;

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
            {pdfUrl ? (
              <>
                <div className="mb-3 h-[min(48vh,460px)] min-h-[240px] w-full overflow-hidden rounded-xl border border-border bg-black/20 lg:h-auto lg:min-h-[440px] lg:flex-1">
                  <iframe title="Vista previa PDF" src={previewSrc} className="h-full w-full border-0" />
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0 flex-1 truncate rounded-lg bg-foreground/5 px-3 py-2 text-xs text-muted-foreground" title={pdfUrl}>
                    {pdfUrl}
                  </div>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Descargar PDF
                    </Button>
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-danger">⚠️ No se encontró PDF para este reporte.</p>
            )}
            <p className="mt-3 text-xs text-warning">
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

        <DialogFooter className="flex flex-wrap gap-2 sm:-mx-6 sm:-mb-6 sm:px-6">
          {!enviado ? (
            <>
              <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleAbrirFormulario} disabled={!pdfUrl} className="gap-2">
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
