"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { Loader2, ShieldCheck, AlertTriangle, Copy, TriangleAlert } from "lucide-react";

export type PanelFactura = {
  idFactura: string;
  numFactura?: string;
  nit?: string;
  proveedor?: string;
  concepto?: string;
  tipoServicio?: string;
  responsable?: string;
  fecha?: string;
  valor: number;
};

type AuditoriaItem = {
  idFactura: string;
  categoria: "desayuno" | "almuerzo" | "cena" | "hospedaje" | "otro";
  tope: number | null;
  estado: "OK" | "EXCEDIDO" | "DUPLICADO";
  diferencia: number;
  alertas: string[];
};

type AuditoriaResp = {
  ok: boolean;
  resumen: string;
  total: number;
  items: AuditoriaItem[];
  totales: { ok: number; excedidos: number; duplicados: number; alertasCoherencia: number };
  error?: string;
};

export function AuditorFacturasPanel({
  facturas,
  coordinador,
  sector,
  historicas,
  autoRun = true,
}: {
  facturas: PanelFactura[];
  coordinador?: string;
  sector?: string;
  historicas?: PanelFactura[];
  autoRun?: boolean;
}) {
  const [data, setData] = useState<AuditoriaResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firma = useMemo(
    () => facturas.map((f) => `${f.idFactura}:${Math.round(f.valor)}`).sort().join("|"),
    [facturas]
  );

  useEffect(() => {
    if (!autoRun) return;
    if (!facturas.length) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const res = await fetch("/api/ia/auditor-facturas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facturas, historicas, coordinador, sector }),
            signal: ctrl.signal,
          });
          const j = (await res.json().catch(() => ({}))) as AuditoriaResp;
          if (!res.ok) {
            setError(j.error || "Error auditando");
            setData(null);
          } else {
            setData(j);
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      })();
    }, 700);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, autoRun, coordinador, sector]);

  const facturasPorId = useMemo(() => {
    const m = new Map<string, PanelFactura>();
    for (const f of facturas) m.set(f.idFactura, f);
    return m;
  }, [facturas]);

  if (!facturas.length) return null;

  return (
    <div className="rounded-lg border border-bia-aqua/20 bg-bia-aqua/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-bia-aqua" />
        <h3 className="text-sm font-semibold text-bia-aqua">Auditor Inteligente · Mi Caja</h3>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-bia-aqua" />}
      </div>

      {error && (
        <div className="rounded bg-red-500/10 border border-red-500/30 p-2 text-xs text-danger">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="OK" value={data.totales.ok} color="emerald" />
            <Tile label="Excedidos" value={data.totales.excedidos} color="amber" />
            <Tile label="Duplicados" value={data.totales.duplicados} color="red" />
            <Tile label="Alertas coherencia" value={data.totales.alertasCoherencia} color="violet" />
          </div>

          {data.resumen && (
            <div className="rounded bg-foreground/5 p-2 text-xs text-foreground/80 whitespace-pre-wrap">
              {data.resumen}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver detalle por factura ({data.items.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {data.items.map((it) => {
                const f = facturasPorId.get(it.idFactura);
                return (
                  <li
                    key={it.idFactura}
                    className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1"
                  >
                    <EstadoBadge estado={it.estado} />
                    <span className="text-foreground font-medium">
                      {f?.proveedor || "Proveedor?"}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="uppercase text-muted-foreground">{it.categoria}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="tabular-nums text-cyan-300">
                      {formatCOP(f?.valor ?? 0)}
                    </span>
                    {it.tope != null ? (
                      <span className="text-muted-foreground">(tope {formatCOP(it.tope)})</span>
                    ) : null}
                    {it.estado === "EXCEDIDO" && it.diferencia > 0 && (
                      <span className="text-warning">+{formatCOP(it.diferencia)}</span>
                    )}
                    {it.alertas.length > 0 && (
                      <span className="text-foreground flex items-center gap-1">
                        <TriangleAlert className="h-3 w-3" />
                        {it.alertas.join("; ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "red" | "violet";
}) {
  const map = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-success",
    amber: "border-amber-500/30 bg-amber-500/10 text-warning",
    red: "border-red-500/30 bg-red-500/10 text-danger",
    violet: "border-foreground/20 bg-foreground/10 text-foreground",
  } as const;
  return (
    <div className={`rounded border px-2 py-1 ${map[color]}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: AuditoriaItem["estado"] }) {
  if (estado === "OK")
    return <Badge className="border-emerald-500/30 bg-emerald-500/10 text-success">OK</Badge>;
  if (estado === "EXCEDIDO")
    return (
      <Badge className="border-amber-500/30 bg-amber-500/10 text-warning gap-1">
        <AlertTriangle className="h-3 w-3" /> EXCEDIDO
      </Badge>
    );
  return (
    <Badge className="border-red-500/30 bg-red-500/10 text-danger gap-1">
      <Copy className="h-3 w-3" /> DUPLICADO
    </Badge>
  );
}
