"use client";

import { useEffect, useMemo, useState } from "react";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseMonto } from "@/lib/format";
import { normalizeSector } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { LucideIcon } from "lucide-react";
import { Clock, Landmark, Receipt, Wallet } from "lucide-react";
import { CountUp } from "@/components/shared/count-up";
import { MetricLabel } from "@/components/shared/metric-label";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { StackedBar } from "@/components/shared/stacked-bar";

type FacturaRow = Record<string, unknown>;
type EntregaRow = Record<string, unknown>;

function montoFactura(f: FacturaRow): number {
  return parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0"));
}
function montoFacturaAprobada(f: FacturaRow): number {
  const est = estadoFactura(f).toLowerCase();
  if (est !== "aprobada" && est !== "completada") return 0;
  return montoFactura(f);
}
function montoEntrega(e: EntregaRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto") || "0"));
}
function respKey(r: Record<string, unknown>): string {
  return String(getCellCaseInsensitive(r, "Responsable") || "").trim().toLowerCase();
}
function estadoFactura(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}

function MetricaBox({ icon, label, value, negative, sub, color }: {
  icon: LucideIcon; label: string; value: number; negative?: boolean; sub?: string; color: string;
}) {
  return (
    <div className="glass lift p-4">
      <MetricLabel icon={icon}>{label}</MetricLabel>
      <p className={`text-xl font-semibold tracking-tight tabular-nums ${color}`}>
        {negative ? "-" : ""}<CountUp value={value} />
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function CoordinadorDashboardClient({ sector, zonaLabel }: { sector: string; zonaLabel: string }) {
  const sectorQuery = useMemo(() => normalizeSector(sector) ?? sector.trim(), [sector]);
  const limite = limiteAprobacionZona(sectorQuery);

  const [tecnicosZona, setTecnicosZona] = useState<{ responsable: string }[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const enc = encodeURIComponent(sectorQuery);
    fetch(`/api/usuarios?sector=${enc}&rol=user`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: { responsable: string }[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          const name = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
          if (name) list.push({ responsable: name });
        }
        setTecnicosZona(list);
      })
      .catch(() => { if (mounted) setTecnicosZona([]); });
    return () => { mounted = false; };
  }, [sectorQuery]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const enc = encodeURIComponent(sectorQuery);
      try {
        const [fRes, eRes] = await Promise.all([
          // Facturas y entregas filtradas por responsables de la zona (servidor)
          fetch(`/api/facturas?zonaSector=${enc}`),
          fetch(`/api/entregas?zonaSector=${enc}`),
        ]);
        const fJson = await fRes.json().catch(() => ({ data: [] })) as { data?: FacturaRow[] };
        const eJson = await eRes.json().catch(() => ({ data: [] })) as { data?: EntregaRow[] };
        if (!mounted) return;
        setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
        setEntregas(Array.isArray(eJson.data) ? eJson.data : []);
      } catch {
        if (!mounted) return;
        setFacturas([]); setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [sectorQuery]);

  // ENTREGADO = suma columna E (Monto_Entregado) de Entregas de la zona
  const totalEntregado = useMemo(
    () => entregas.reduce((s, e) => s + montoEntrega(e), 0),
    [entregas]
  );

  // FACTURADO = suma solo Aprobada/Completada (igual que el saldo del técnico)
  const totalFacturado = useMemo(
    () => facturas.reduce((s, f) => s + montoFacturaAprobada(f), 0),
    [facturas]
  );

  // PENDIENTE = por técnico: entregado - aprobado (solo positivos)
  const pendienteLegalizar = useMemo(() => {
    const resps = new Set([...entregas.map(respKey), ...facturas.map(respKey)].filter(Boolean));
    let total = 0;
    for (const resp of Array.from(resps)) {
      const entregado = entregas.filter((e) => respKey(e) === resp).reduce((s, e) => s + montoEntrega(e), 0);
      const facturado = facturas.filter((f) => respKey(f) === resp).reduce((s, f) => s + montoFacturaAprobada(f), 0);
      const saldo = entregado - facturado;
      if (saldo > 0) total += saldo;
    }
    return total;
  }, [entregas, facturas]);

  // EN CAJA = Facturado − Entregado (igual que admin dashboard)
  const enCaja = useMemo(
    () => totalFacturado - totalEntregado,
    [totalFacturado, totalEntregado]
  );

  const pctEntregado = limite > 0 ? Math.min(100, Math.round((totalEntregado / limite) * 100)) : 0;
  const pctFacturado = limite > 0 ? Math.min(100, Math.round((totalFacturado / limite) * 100)) : 0;
  const pctPendiente = limite > 0 ? Math.min(100, Math.round((pendienteLegalizar / limite) * 100)) : 0;

  const facturasPendientes = useMemo(() =>
    facturas.filter((f) => estadoFactura(f).toLowerCase() === "pendiente").length, [facturas]);
  const facturasAprobadas = useMemo(() =>
    facturas.filter((f) => { const e = estadoFactura(f).toLowerCase(); return e === "aprobada" || e === "completada"; }).length, [facturas]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando zona">
        <SkeletonCard className="h-20" lines={2} />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard className="h-28" lines={3} />
          <SkeletonCard className="h-28" lines={3} />
          <SkeletonCard className="h-28" lines={3} />
          <SkeletonCard className="h-28" lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Zona {zonaLabel}</h1>
        <p className="text-sm text-muted-foreground">Límite de caja menor: {formatCOP(limite)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricaBox icon={Wallet} label="Entregado" value={totalEntregado} sub={`${pctEntregado}% del límite`} color="text-foreground" />
        <MetricaBox icon={Receipt} label="Facturado" value={totalFacturado} sub={`${pctFacturado}% del límite`} color="text-foreground" />
        <MetricaBox icon={Clock} label="Pendiente legalizar" value={pendienteLegalizar} sub="Entregado sin facturar" color="text-warning" />
        <MetricaBox
          icon={Landmark}
          label="En caja"
          value={Math.abs(enCaja)}
          negative={enCaja < 0}
          sub="Facturado − Entregado"
          color={enCaja >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <div className="glass-strong p-5">
        <div className="mb-3 flex justify-between text-xs text-muted-foreground">
          <span>Uso de la caja menor</span>
          <span><CountUp value={pctEntregado} format={(n) => `${n}%`} /> entregado</span>
        </div>
        <StackedBar
          size="lg"
          showPctInLegend
          segments={[
            { key: "f", label: "Facturado", pct: pctFacturado, value: formatCOP(totalFacturado), className: "bg-brand", dotClassName: "bg-brand" },
            { key: "p", label: "Pendiente", pct: pctPendiente, value: formatCOP(pendienteLegalizar), className: "bg-gradient-to-b from-yellow-200 to-yellow-400", dotClassName: "bg-yellow-400" },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-strong lift p-4 text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums"><CountUp value={tecnicosZona.length} format={String} /></p>
          <p className="mt-1 text-xs text-muted-foreground">Técnicos</p>
        </div>
        <div className="glass-strong lift p-4 text-center">
          <p className="text-2xl font-semibold tracking-tight text-warning tabular-nums"><CountUp value={facturasPendientes} format={String} /></p>
          <p className="mt-1 text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="glass-strong lift p-4 text-center">
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums"><CountUp value={facturasAprobadas} format={String} /></p>
          <p className="mt-1 text-xs text-muted-foreground">Aprobadas</p>
        </div>
      </div>
    </div>
  );
}