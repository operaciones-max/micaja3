"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FacturaEditDialog } from "@/components/coordinador/factura-edit-dialog";
import { FacturaImagenModal } from "@/components/factura-imagen-modal";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { Portal } from "@/components/shared/portal";
import { AccionIcono, FacturaFila, FilasEsqueleto, ListaFacturas, PieLista, SinFacturas } from "@/components/facturas/lista-facturas";
import { useRenderProgresivo } from "@/components/facturas/use-render-progresivo";

type FacturaItem = Record<string, unknown>;

export function FacturasUsuarioClient() {
  const { data } = useSession();
  const responsable = String(data?.user?.responsable || "");
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [editar, setEditar] = useState<FacturaItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const loadFacturas = useCallback(async () => {
    if (!responsable) {
      setFacturas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ responsable });
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [responsable, desde, hasta]);

  useEffect(() => {
    void loadFacturas();
  }, [loadFacturas]);

  const facturasOrdenadas = useMemo(() => {
    const key = (f: FacturaItem) => {
      const fc = String(getCellCaseInsensitive(f, "FechaCreacion", "Fecha_ISO") || "");
      const tFc = fc ? new Date(fc).getTime() : NaN;
      if (Number.isFinite(tFc)) return tFc;
      const fd = String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
      return new Date(fd).getTime() || 0;
    };
    return [...facturas].sort((a, b) => key(b) - key(a));
  }, [facturas]);

  const { visibles, centinela, verMas, reiniciar } = useRenderProgresivo(facturasOrdenadas);
  useEffect(() => {
    reiniciar();
  }, [desde, hasta, reiniciar]);

  const bannerGuardado = useMemo(() => {
    if (typeof window === "undefined") return null;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("saved") !== "1") return null;
    const auto = qs.get("auto");
    if (auto === "aprobada") {
      return { clase: "bg-foreground/10 text-foreground border-foreground/20", texto: "Factura guardada y aprobada automáticamente" };
    }
    if (auto === "pendiente") {
      return {
        clase: "border-amber-500/30 bg-amber-500/10 text-warning",
        texto: "Factura guardada. Pendiente de revisión por tu coordinador.",
      };
    }
    return { clase: "bg-emerald-700 text-white", texto: "Factura guardada" };
  }, []);

  return (
    <div className="space-y-4">
      <FacturaEditDialog
        factura={editar}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditar(null);
        }}
        onSaved={() => void loadFacturas()}
      />
      <Card data-sin-brillo className="text-foreground">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturas</CardTitle>
          {bannerGuardado ? (
            <Badge variant="outline" className={`${bannerGuardado.clase} shrink-0`}>
              {bannerGuardado.texto}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <Label className="mb-1 text-xs text-bia-gray">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="bg-bia-blue border-bia-gray/40 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1 text-xs text-bia-gray">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="bg-bia-blue border-bia-gray/40 [color-scheme:dark]"
              />
            </div>
            {(desde || hasta) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDesde(""); setHasta(""); }}
                className="border-border text-muted-foreground"
              >
                Limpiar
              </Button>
            )}
            <div className="ml-auto text-xs text-bia-gray">
              {loading ? "Cargando..." : `${facturasOrdenadas.length} factura${facturasOrdenadas.length === 1 ? "" : "s"}`}
            </div>
          </div>
          {loading ? (
            <FilasEsqueleto />
          ) : facturasOrdenadas.length ? (
            <ListaFacturas>
              {visibles.map((f, i) => {
                const fid = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "");
                return (
                  <FacturaFila
                    key={fid || i}
                    f={f}
                    indice={i}
                    onVerImagen={setImagenModal}
                    acciones={
                      fid ? (
                        <AccionIcono
                          label="Editar"
                          onClick={() => {
                            setEditar(f);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil />
                        </AccionIcono>
                      ) : null
                    }
                  />
                );
              })}
            </ListaFacturas>
          ) : (
            <SinFacturas>No hay facturas registradas</SinFacturas>
          )}
          {!loading ? <PieLista mostradas={visibles.length} total={facturasOrdenadas.length} centinela={centinela} onMas={verMas} /> : null}
        </CardContent>
      </Card>

      <FacturaImagenModal src={imagenModal} onClose={() => setImagenModal(null)} />

      <Portal>
        <Link href="/facturas/nueva" className="fixed bottom-28 right-4 z-40 md:bottom-8">
          <Button className="h-12 w-12 rounded-full bg-bia-aqua text-bia-blue font-semibold shadow-lg">+</Button>
        </Link>
      </Portal>
    </div>
  );
}
