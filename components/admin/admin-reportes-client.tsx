/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FirmaCanvas } from "@/components/firma-canvas";
import type { FacturaPdf } from "@/components/pdf/legalizacion-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BiaAlert } from "@/components/ui/bia-alert";
import { BiaConfirm } from "@/components/ui/bia-confirm";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString } from "@/lib/format";
import { facturasDelReporteLocal, generarPdfLegalizacion, subirPdfLegalizacion } from "@/lib/legalizacion-pdf-client";
import { AuditorFacturasPanel, type PanelFactura } from "@/components/shared/auditor-facturas-panel";
import { Portal } from "@/components/shared/portal";

type ReporteRow = Record<string, string>;
type FacturaRow = Record<string, unknown>;

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

function isMicajaSector(s: string): boolean {
  return s === "Bogota" || s === "Costa Caribe";
}

function firmaSrc(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("data:") || t.startsWith("http://") || t.startsWith("https://")) return t;
  return `data:image/png;base64,${t}`;
}

/** URL para previsualizar adjunto (data URL, http(s) o Drive por id). */
function adjuntoVistaSrc(f: FacturaPdf): string | null {
  const u = f.imagenUrl?.trim();
  if (u && !u.startsWith("Facturas_Images")) {
    if (u.startsWith("data:") || u.startsWith("http://") || u.startsWith("https://")) {
      return u;
    }
  }
  const id = f.driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?id=${id}`;
  return null;
}

export function AdminReportesClient() {
  const { data } = useSession();
  const adminSector = String(data?.user?.sector || "Bogota");

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [activo, setActivo] = useState<ReporteRow | null>(null);
  const [facturasReporte, setFacturasReporte] = useState<FacturaPdf[]>([]);
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [firmaAdmin, setFirmaAdmin] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorRegen, setErrorRegen] = useState("");
  const [regenerandoId, setRegenerandoId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null);
  const [resumenIA, setResumenIA] = useState("");
  const [cargandoResumenIA, setCargandoResumenIA] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, fRes] = await Promise.all([fetch("/api/legalizaciones"), fetch("/api/facturas")]);
      const [rJson, fJson] = await Promise.all([
        rRes.json().catch(() => ({ data: [] })),
        fRes.json().catch(() => ({ data: [] })),
      ]);
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
      setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
    } catch {
      setReportes([]);
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirReporte(reporte: ReporteRow) {
    setActivo(reporte);
    setFirmaAdmin("");
    setImagenModal(null);
    try {
      const raw = String(reporte.Facturas_IDs || reporte.FacturasIds || "[]");
      let parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === "object" &&
        parsed[0] !== null
      ) {
        setFacturasReporte(parsed as FacturaPdf[]);
        return;
      }
    } catch {
      /* usar fallback */
    }
    setFacturasReporte(facturasDelReporteLocal(reporte, facturas));
  }

  async function confirmarFirmaAdmin() {
    if (!activo || !firmaAdmin.trim()) return;
    setProcesando(true);
    setErrorMsg("");
    setSuccessMsg("");
    let stage = "init";
    try {
      const sectorRep = String(activo.Sector || adminSector);
      const coordNombre = String(activo.Coordinador || "");
      const blob = await generarPdfLegalizacion({
        reporte: activo,
        limite: limiteAprobacionZona(sectorRep),
        firmaAdmin,
        sectorPorDefecto: adminSector,
        facturasLocales: facturas,
        onEtapa: (etapa) => {
          stage = etapa;
        },
      });

      const idRep = reporteId(activo);
      const url = await subirPdfLegalizacion({
        blob,
        sector: isMicajaSector(sectorRep) ? sectorRep : adminSector,
        responsable: coordNombre,
        onEtapa: (etapa) => {
          stage = etapa;
        },
      });

      stage = "guardando firma";
      const patchRes = await fetch(`/api/legalizaciones/${encodeURIComponent(idRep)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmaAdmin, pdfUrl: url }),
      });
      if (!patchRes.ok) {
        const pj = await patchRes.json().catch(() => ({}));
        throw new Error(String(pj.error || `PATCH firma fallo HTTP ${patchRes.status}`));
      }

      setActivo(null);
      setFirmaAdmin("");
      await cargar();
      setSuccessMsg("Reporte firmado y PDF generado correctamente");
    } catch (e: unknown) {
      console.error(`[admin firma] error en stage "${stage}":`, e);
      const detalle =
        e instanceof Error && e.message
          ? e.message
          : typeof e === "string" && e
          ? e
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();
      setErrorMsg(`Falló en "${stage}": ${detalle || "sin detalle"}`);
    } finally {
      setProcesando(false);
    }
  }

  /**
   * Vuelve a generar el PDF de un reporte ya firmado con el logo y el monto asignado actuales
   * (mismas facturas y firmas) y reemplaza el archivo guardado. Para actas hechas con una versión anterior.
   */
  async function regenerarPdfGuardado(r: ReporteRow) {
    const id = reporteId(r);
    if (!id || regenerandoId) return;
    setRegenerandoId(id);
    setErrorRegen("");
    setSuccessMsg("");
    let stage = "init";
    try {
      const sectorRep = String(r.Sector || adminSector);
      const creado = new Date(String(r.Fecha_ISO || ""));
      const firma = String(r.Firma_Admin || r.FirmaAdmin || "");
      if (!firma) throw new Error("el reporte no tiene la firma del administrador");
      const blob = await generarPdfLegalizacion({
        reporte: r,
        limite: limiteAprobacionZona(sectorRep),
        firmaAdmin: firma,
        sectorPorDefecto: adminSector,
        facturasLocales: facturas,
        // Se conserva la fecha del reporte, no la de hoy
        fechaGeneracion: Number.isNaN(creado.getTime()) ? undefined : creado.toLocaleDateString("es-CO"),
        onEtapa: (etapa) => {
          stage = etapa;
        },
      });
      const url = await subirPdfLegalizacion({
        blob,
        sector: isMicajaSector(sectorRep) ? sectorRep : adminSector,
        responsable: String(r.Coordinador || ""),
        onEtapa: (etapa) => {
          stage = etapa;
        },
      });
      stage = "guardando el PDF";
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerarPdf: true, pdfUrl: url }),
      });
      if (!res.ok) {
        const pj = await res.json().catch(() => ({}));
        throw new Error(String(pj.error || `HTTP ${res.status}`));
      }
      await cargar();
      setSuccessMsg("PDF regenerado con el logo y el monto asignado actuales");
    } catch (e: unknown) {
      console.error(`[regenerar pdf] error en "${stage}":`, e);
      setErrorRegen(`No se pudo regenerar el PDF (falló en "${stage}"): ${e instanceof Error ? e.message : "sin detalle"}`);
    } finally {
      setRegenerandoId(null);
    }
  }

  async function eliminarReporteConfirmado(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        await cargar();
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body?.error || `Error al eliminar (${res.status})`);
      }
    } catch {
      setErrorMsg("Error de red al eliminar el reporte");
    }
  }

  return (
    <div className="space-y-4">
      {confirmEliminarId ? (
        <BiaConfirm
          mensaje="¿Eliminar este reporte?"
          confirmLabel="Eliminar"
          onCancelar={() => setConfirmEliminarId(null)}
          onConfirmar={() => {
            const id = confirmEliminarId;
            setConfirmEliminarId(null);
            void eliminarReporteConfirmado(id);
          }}
        />
      ) : null}
      {successMsg ? <BiaAlert type="success" message={successMsg} /> : null}
      {errorRegen ? <BiaAlert type="error" message={errorRegen} /> : null}
      <Card className="text-foreground">
        <CardHeader>
          <CardTitle>Reportes de legalización</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Coordinador</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : reportes.length ? (
                reportes.map((r, i) => {
                  const id = reporteId(r);
                  const est = String(r.Estado || "");
                  const pdfUrl = String(r.PDF_URL || r.PdfURL || "").trim();
                  return (
                    <TableRow key={`${id}-${i}`}>
                      <TableCell>{r.Fecha_Creacion || r.Fecha_ISO || "—"}</TableCell>
                      <TableCell>{r.Coordinador || "—"}</TableCell>
                      <TableCell>{r.Sector || "—"}</TableCell>
                      <TableCell className="max-w-[200px] text-xs whitespace-pre-wrap">
                        {r.Periodo_Desde || r.Periodo || "—"} → {r.Periodo_Hasta || "—"}
                      </TableCell>
                      <TableCell>{formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}</TableCell>
                      <TableCell>
                        {est === "Firmado" || est === "Enviado FX" ? (
                          <Badge className="border-bia-aqua/30 bg-bia-aqua/10 text-bia-aqua">{est}</Badge>
                        ) : (
                          <Badge className="border-warning/40 bg-warning/15 text-warning">{est}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {est === "Pendiente Admin" ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => abrirReporte(r)}>
                              ✍️ Revisar y firmar
                            </Button>
                          ) : null}
                          {est === "Firmado" || est === "Enviado FX" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-bia-gray/30"
                              disabled={regenerandoId !== null}
                              title="Vuelve a generar el PDF con el logo y el monto asignado actuales (mismas facturas y firmas)"
                              onClick={() => void regenerarPdfGuardado(r)}
                            >
                              {regenerandoId === id ? "Generando…" : "↻ Regenerar PDF"}
                            </Button>
                          ) : null}
                          {pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center rounded-lg border border-bia-gray/30 px-2.5 text-[0.8rem] text-foreground hover:bg-bia-blue-mid"
                            >
                              ⬇ Descargar
                            </a>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-danger"
                            onClick={() => setConfirmEliminarId(id)}
                          >
                            🗑️
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-bia-gray">
                    No hay reportes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!activo}
        onOpenChange={(o) => {
          if (!o) {
            setActivo(null);
            setImagenModal(null);
            setFacturasReporte([]);
            setResumenIA("");
            setCargandoResumenIA(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-bia-gray/20 bg-bia-blue-mid text-foreground sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar y firmar</DialogTitle>
          </DialogHeader>
          {activo ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
                <div>
                  <span className="text-bia-gray">Coordinador</span>
                  <p className="text-foreground">{activo.Coordinador || "—"}</p>
                </div>
                <div>
                  <span className="text-bia-gray">Sector</span>
                  <p className="text-foreground">{activo.Sector || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-bia-gray">Período</span>
                  <p className="text-foreground">
                    {activo.Periodo_Desde || activo.Periodo || "—"} al {activo.Periodo_Hasta || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-bia-gray">Total</span>
                  <p className="text-foreground">
                    {formatCOP(parseCOPString(String(activo.Total || activo.TotalAprobado || "0")))}
                  </p>
                </div>
              </div>

              {facturasReporte.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">
                    Facturas incluidas ({facturasReporte.length})
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 glass text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">No.</th>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-left">Concepto</th>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-center">Adjunto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturasReporte.map((f, i) => {
                          const imgSrc = adjuntoVistaSrc(f);
                          return (
                            <tr
                              key={`${f.id || i}-${i}`}
                              className="border-t border-border hover:bg-muted/50"
                            >
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-2 text-foreground">{f.proveedor || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{f.concepto || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{f.fecha || "—"}</td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-foreground">
                                ${Number(f.valor || 0).toLocaleString("es-CO")}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {imgSrc ? (
                                  <button
                                    type="button"
                                    onClick={() => setImagenModal(imgSrc)}
                                    className="text-xs text-foreground hover:underline"
                                  >
                                    🖼️ Ver
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="glass">
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground"
                          >
                            Total:
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-foreground">
                            $
                            {facturasReporte
                              .reduce((s, f) => s + Number(f.valor || 0), 0)
                              .toLocaleString("es-CO")}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null}

              {(resumenIA || cargandoResumenIA) && (
                <div className="my-4 rounded-xl border border-foreground/15 bg-foreground/5 p-4">
                  <p className="mb-2 text-xs font-semibold text-foreground">✨ Análisis IA</p>
                  {cargandoResumenIA ? (
                    <p className="animate-pulse text-sm text-muted-foreground">Generando resumen...</p>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground">{resumenIA}</p>
                  )}
                </div>
              )}

              {facturasReporte.length > 0 && (
                <div className="my-4">
                  <AuditorFacturasPanel
                    facturas={facturasReporte.map<PanelFactura>((f) => ({
                      idFactura: String(f.id || ""),
                      numFactura: String((f as unknown as { numFactura?: string }).numFactura || ""),
                      nit: String((f as unknown as { nit?: string }).nit || ""),
                      proveedor: String(f.proveedor || ""),
                      concepto: String(f.concepto || ""),
                      tipoServicio: String((f as unknown as { tipoServicio?: string }).tipoServicio || ""),
                      responsable: String(activo.Coordinador || ""),
                      fecha: String(f.fecha || ""),
                      valor: Number(f.valor || 0),
                    }))}
                    coordinador={String(activo.Coordinador || "")}
                    sector={String(activo.Sector || "")}
                  />
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-sm text-muted-foreground">Firma del coordinador:</p>
                {firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || "")) ? (
                  <img
                    src={firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || ""))}
                    alt="Firma coordinador"
                    className="h-20 rounded border border-border bg-white object-contain p-2"
                  />
                ) : (
                  <p className="text-xs italic text-muted-foreground">Sin firma registrada</p>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-1 text-sm text-bia-gray-light">Tu firma:</p>
                <FirmaCanvas
                  width={400}
                  height={150}
                  onFirma={(b64) => setFirmaAdmin(b64)}
                  onLimpiar={() => setFirmaAdmin("")}
                />
              </div>

              {errorMsg ? <p className="mt-2 text-sm text-danger">{errorMsg}</p> : null}

              <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" onClick={() => setActivo(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-bia-aqua text-bia-blue hover:bg-bia-aqua/90"
                  disabled={!firmaAdmin.trim() || procesando}
                  onClick={() => void confirmarFirmaAdmin()}
                >
                  {procesando ? "Generando PDF..." : "✅ Firmar y generar PDF"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {imagenModal ? (
        <Portal>
          <div
            role="presentation"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setImagenModal(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg overflow-hidden rounded-xl bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between glass-strong px-4 py-2">
                <span className="text-sm font-medium text-foreground">Factura adjunta</span>
                <button
                  type="button"
                  onClick={() => setImagenModal(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <img
                src={
                  imagenModal.startsWith("data:")
                    ? imagenModal
                    : `/api/proxy-imagen?url=${encodeURIComponent(imagenModal)}`
                }
                alt="Factura"
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
