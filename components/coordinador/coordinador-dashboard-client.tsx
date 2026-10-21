"use client";

import { useEffect, useMemo, useState } from "react";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseMonto } from "@/lib/format";
import { normalizeSector } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

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

function MetricaBox({ icon, label, valor, sub, color }: {
  icon: string; label: string; valor: string; sub?: string; color: string;
}) {
  return (
    <div className="glass p-4">
      <p className="mb-1 text-xs text-muted-foreground">{icon} {label}</p>
      <p className={`text-xl font-bold ${color}`}>{valor}</p>
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
    return <div className="animate-pulse p-8 text-muted-foreground">Cargando zona...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Zona {zonaLabel}</h1>
        <p className="text-sm text-muted-foreground">Límite de caja menor: {formatCOP(limite)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricaBox icon="💸" label="Entregado" valor={formatCOP(totalEntregado)} sub={`${pctEntregado}% del límite`} color="text-foreground" />
        <MetricaBox icon="🧾" label="Facturado" valor={formatCOP(totalFacturado)} sub={`${pctFacturado}% del límite`} color="text-foreground" />
        <MetricaBox icon="⚠️" label="Pendiente legalizar" valor={formatCOP(pendienteLegalizar)} sub="Entregado sin facturar" color="text-warning" />
        <MetricaBox
          icon="🏦"
          label="En caja"
          valor={`${enCaja < 0 ? "-" : ""}${formatCOP(Math.abs(enCaja))}`}
          sub="Facturado − Entregado"
          color={enCaja >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      <div className="glass-strong p-5">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>Uso de la caja menor</span>
          <span>{pctEntregado}% entregado</span>
        </div>
        <div className="flex h-5 gap-0.5 overflow-hidden rounded-full bg-track shadow-inner">
          <div style={{ width: `${pctFacturado}%` }} className="h-full rounded-full bg-brand transition-all duration-500" />
          <div style={{ width: `${pctPendiente}%` }} className="h-full rounded-full bg-yellow-400 transition-all duration-500" />
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand" />Facturado ({pctFacturado}%)
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />Pendiente ({pctPendiente}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-strong p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{tecnicosZona.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Técnicos</p>
        </div>
        <div className="glass-strong p-4 text-center">
          <p className="text-2xl font-bold text-warning">{facturasPendientes}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="glass-strong p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{facturasAprobadas}</p>
          <p className="mt-1 text-xs text-muted-foreground">Aprobadas</p>
        </div>
      </div>
    </div>
  );
}