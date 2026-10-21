"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaZona, LIMITE_CAJA_MENOR } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString, parseMonto, parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaRow = Record<string, unknown>;
type EntregaRow = Record<string, unknown>;
type ReporteRow = Record<string, string>;

function facturaEstado(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}
function montoEntregaRow(e: EntregaRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto", "Valor") || "0"));
}
function facturaFecha(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
}
function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}
function respKey(r: Record<string, unknown>): string {
  return String(getCellCaseInsensitive(r, "Responsable") || "").trim().toLowerCase();
}

function BarraProgreso({ pctFacturado, pctPendiente }: { pctFacturado: number; pctPendiente: number }) {
  return (
    <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-track shadow-inner">
      <div style={{ width: `${pctFacturado}%` }} className="h-full rounded-full bg-brand transition-all duration-500" />
      <div style={{ width: `${pctPendiente}%` }} className="h-full rounded-full bg-yellow-400 transition-all duration-500" />
    </div>
  );
}

function montoFacturaAprobada(f: FacturaRow): number {
  const est = facturaEstado(f).toLowerCase();
  if (est !== "aprobada" && est !== "completada") return 0;
  return parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0"));
}

// ── PENDIENTE por usuario: entregado − aprobado, solo positivos ──
function calcularPendiente(entregas: EntregaRow[], facturas: FacturaRow[]): number {
  const resps = new Set([...entregas.map(respKey), ...facturas.map(respKey)].filter(Boolean));
  let total = 0;
  for (const resp of Array.from(resps)) {
    const entregado = entregas.filter((e) => respKey(e) === resp).reduce((s, e) => s + montoEntregaRow(e), 0);
    const aprobado = facturas.filter((f) => respKey(f) === resp).reduce((s, f) => s + montoFacturaAprobada(f), 0);
    const saldo = entregado - aprobado;
    if (saldo > 0) total += saldo;
  }
  return total;
}

function CajaCard({ titulo, subtitulo, limite, tecnicos, entregado, facturado, pendiente, enCaja, pctEntregado, pctFacturado, pctPendiente }: {
  titulo: string; subtitulo: string; limite: number; tecnicos: number;
  entregado: number; facturado: number; pendiente: number; enCaja: number;
  pctEntregado: number; pctFacturado: number; pctPendiente: number;
}) {
  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{subtitulo} · Límite {formatCOP(limite)} · {tecnicos} técnicos</p>
        </div>
        <span className="text-lg font-bold text-foreground">{pctEntregado}%</span>
      </div>
      <BarraProgreso pctFacturado={pctFacturado} pctPendiente={pctPendiente} />
      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand inline-block" />Facturado</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />Pendiente</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><p className="text-xs text-muted-foreground">💸 Entregado</p><p className="font-bold text-foreground text-sm">{formatCOP(entregado)}</p></div>
        <div><p className="text-xs text-muted-foreground">🧾 Facturado</p><p className="font-bold text-foreground text-sm">{formatCOP(facturado)}</p></div>
        <div><p className="text-xs text-muted-foreground">⚠️ Pendiente legalizar</p><p className="font-bold text-warning text-sm">{formatCOP(pendiente)}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">🏦 En caja</p>
          <p className={`font-bold text-sm ${enCaja >= 0 ? "text-success" : "text-danger"}`}>
            {enCaja < 0 ? "-" : ""}{formatCOP(Math.abs(enCaja))}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);

  // Bogotá y Costa Caribe comparten una sola caja menor: se suman en una tarjeta.
  const [facturasCaja, setFacturasCaja] = useState<FacturaRow[]>([]);
  const [todasFacturas, setTodasFacturas] = useState<FacturaRow[]>([]); // solo para la tabla de últimas facturas

  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [entregasCaja, setEntregasCaja] = useState<EntregaRow[]>([]);
  const [totalTecnicos, setTotalTecnicos] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const encB = encodeURIComponent("Bogota");
      const encC = encodeURIComponent("Costa Caribe");

      // ✅ CAMBIO: pedimos facturas filtradas por zona desde la API,
      //    igual que hacemos con las entregas — así el cálculo coincide
      //    con lo que ve el coordinador de cada zona.
      const [fBogRes, fCostaRes, fTodasRes, rRes, eBogRes, eCostaRes] = await Promise.all([
        fetch(`/api/facturas?zonaSector=${encB}`),
        fetch(`/api/facturas?zonaSector=${encC}`),
        fetch("/api/facturas"),           // para la tabla de últimas 10
        fetch("/api/legalizaciones"),
        fetch(`/api/entregas?zonaSector=${encB}`),
        fetch(`/api/entregas?zonaSector=${encC}`),
      ]);

      const [fBogJson, fCostaJson, fTodasJson, rJson, eBogJson, eCostaJson] = await Promise.all([
        fBogRes.json().catch(() => ({ data: [] })),
        fCostaRes.json().catch(() => ({ data: [] })),
        fTodasRes.json().catch(() => ({ data: [] })),
        rRes.json().catch(() => ({ data: [] })),
        eBogRes.json().catch(() => ({ data: [] })),
        eCostaRes.json().catch(() => ({ data: [] })),
      ]);

      const lista = (j: { data?: unknown }): Record<string, unknown>[] =>
        Array.isArray(j.data) ? (j.data as Record<string, unknown>[]) : [];

      setFacturasCaja([...lista(fBogJson), ...lista(fCostaJson)]);
      setTodasFacturas(lista(fTodasJson));
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
      setEntregasCaja([...lista(eBogJson), ...lista(eCostaJson)]);
    } catch {
      setFacturasCaja([]); setTodasFacturas([]);
      setReportes([]); setEntregasCaja([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usuarios?rol=user")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setTotalTecnicos(Array.isArray(d.data) ? d.data.length : 0);
      })
      .catch(() => { if (!cancelled) setTotalTecnicos(0); });
    return () => { cancelled = true; };
  }, []);

  // ── CAJA MENOR ── Bogotá + Costa Caribe en una sola tarjeta, un solo límite
  const caja = useMemo(() => {
    const entregado = entregasCaja.reduce((s, e) => s + montoEntregaRow(e), 0);
    const facturado = facturasCaja.reduce((s, f) => s + montoFacturaAprobada(f), 0);
    const pendiente = calcularPendiente(entregasCaja, facturasCaja);
    const enCaja = facturado - entregado;
    const pct = (monto: number) => Math.min(100, Math.round((monto / LIMITE_CAJA_MENOR) * 100));
    return {
      entregado, facturado, pendiente, enCaja,
      pctEntregado: pct(entregado), pctFacturado: pct(facturado), pctPendiente: pct(pendiente),
    };
  }, [facturasCaja, entregasCaja]);

  // ✅ facturasPendientes usa todasFacturas para no perder ninguna
  const facturasPendientes = useMemo(() => todasFacturas.filter((f) => facturaEstado(f).toLowerCase() === "pendiente").length, [todasFacturas]);
  const reportesPendientesFirma = useMemo(() => reportes.filter((r) => { const e = String(r.Estado || "").toLowerCase(); return e.includes("pendiente") || e === "enviado"; }).length, [reportes]);
  const ultimasFacturas = useMemo(() => {
    const keyFecha = (f: FacturaRow): number => {
      const fc = String(getCellCaseInsensitive(f, "FechaCreacion", "Fecha_ISO") || "");
      const tFc = fc ? new Date(fc).getTime() : NaN;
      if (Number.isFinite(tFc)) return tFc;
      return parseSheetDate(facturaFecha(f))?.getTime() ?? 0;
    };
    return [...todasFacturas].sort((a, b) => keyFecha(b) - keyFecha(a)).slice(0, 10);
  }, [todasFacturas]);
  const reportesPendientes = useMemo(() => reportes.filter((r) => { const e = String(r.Estado || "").toLowerCase(); return e.includes("pendiente") || e === "enviado"; }), [reportes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel administrador</h1>
        <p className="text-sm text-muted-foreground">Resumen MiCaja · Bogotá y Costa Caribe</p>
      </div>

      {/* ── CAJA MENOR ── */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="h-48 animate-pulse glass" />
        ) : (
          <CajaCard titulo="Caja menor" subtitulo="Bogotá + Costa Caribe" limite={LIMITE_CAJA_MENOR} tecnicos={totalTecnicos}
            entregado={caja.entregado} facturado={caja.facturado} pendiente={caja.pendiente} enCaja={caja.enCaja}
            pctEntregado={caja.pctEntregado} pctFacturado={caja.pctFacturado} pctPendiente={caja.pctPendiente} />
        )}
      </div>

      {/* ── CONTADORES ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <p className="mb-1 text-xs text-muted-foreground">📋 Facturas pendientes</p>
          <p className="text-2xl font-bold text-warning">{loading ? "—" : facturasPendientes}</p>
          <p className="text-xs text-muted-foreground">por revisar</p>
        </div>
        <div className="glass p-4">
          <p className="mb-1 text-xs text-muted-foreground">✍️ Reportes por firmar</p>
          <p className="text-2xl font-bold text-orange">{loading ? "—" : reportesPendientesFirma}</p>
          <p className="text-xs text-muted-foreground">pendientes</p>
        </div>
      </div>

      {/* ── ÚLTIMAS FACTURAS ── */}
      <Card className="glass text-foreground">
        <CardHeader><CardTitle className="text-base">Últimas 10 facturas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-muted-foreground">Responsable</TableHead>
                <TableHead className="text-muted-foreground">Proveedor</TableHead>
                <TableHead className="text-muted-foreground">Valor</TableHead>
                <TableHead className="text-muted-foreground">Zona</TableHead>
                <TableHead className="text-muted-foreground">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6}><div className="h-6 animate-pulse rounded bg-foreground/5" /></TableCell></TableRow>
              ) : ultimasFacturas.length ? (
                ultimasFacturas.map((f, i) => (
                  <TableRow key={i} className="border-border hover:bg-foreground/5">
                    <TableCell className="whitespace-nowrap text-sm">{facturaFecha(f) || "—"}</TableCell>
                    <TableCell className="text-sm">{String(getCellCaseInsensitive(f, "Responsable") || "—")}</TableCell>
                    <TableCell className="text-sm">{String(getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—")}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatCOP(parseCOPString(String(getCellCaseInsensitive(f, "Valor", "Monto_Factura") || "0")))}</TableCell>
                    <TableCell className="text-sm">{etiquetaZona(String(getCellCaseInsensitive(f, "Sector") || ""))}</TableCell>
                    <TableCell className="text-sm">{facturaEstado(f)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Sin facturas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── REPORTES PENDIENTES ── */}
      <Card className="glass text-foreground">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Reportes pendientes de firma</CardTitle>
          <Link href="/admin/reportes" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs hover:bg-foreground/5">
            Ir a reportes
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Fecha</TableHead>
                <TableHead className="text-muted-foreground">Coordinador</TableHead>
                <TableHead className="text-muted-foreground">Zona</TableHead>
                <TableHead className="text-muted-foreground">Total</TableHead>
                <TableHead className="text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}><div className="h-6 animate-pulse rounded bg-foreground/5" /></TableCell></TableRow>
              ) : reportesPendientes.length ? (
                reportesPendientes.map((r, i) => (
                  <TableRow key={`${reporteId(r)}-${i}`} className="border-border hover:bg-foreground/5">
                    <TableCell className="text-sm">{r.Fecha || "—"}</TableCell>
                    <TableCell className="text-sm">{r.Coordinador || "—"}</TableCell>
                    <TableCell className="text-sm">{etiquetaZona(String(r.Sector || ""))}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}</TableCell>
                    <TableCell className="text-right">
                      <Link href="/admin/reportes" className="inline-flex h-7 items-center rounded-lg bg-foreground/5 px-3 text-xs hover:bg-foreground/10">
                        ✍️ Firmar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No hay reportes pendientes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}