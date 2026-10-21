"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { Session } from "next-auth";

type FacturaItem = Record<string, unknown>;
type EntregaItem = Record<string, unknown>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MC";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function UserHomeClient({ user }: { user: Session["user"] }) {
  // useSession garantiza el mismo responsable que usa /entregas (que sí funciona)
  const { data: sessionData } = useSession();
  const responsable = String(sessionData?.user?.responsable || user.responsable || "");
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);

  useEffect(() => {
    if (!responsable) return;
    let mounted = true;
    async function loadData() {
      const enc = encodeURIComponent(responsable);
      const [fResult, eResult] = await Promise.allSettled([
        fetch(`/api/facturas?responsable=${enc}`).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/entregas?responsable=${enc}`).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);
      if (!mounted) return;
      if (fResult.status === "fulfilled") setFacturas(Array.isArray(fResult.value?.data) ? fResult.value.data : []);
      if (eResult.status === "fulfilled") setEntregas(Array.isArray(eResult.value?.data) ? eResult.value.data : []);
      setLoading(false);
    }
    void loadData();
    return () => { mounted = false; };
  }, [responsable]);

  // Recibido = Total entregas al técnico
  const totalRecibido = useMemo(
    () => entregas.reduce((s, e) => s + parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto") || "0")), 0),
    [entregas]
  );

  // Solo facturas Aprobadas o Completadas cuentan como gasto real (auto-aprobada incluida)
  const totalAprobado = useMemo(
    () => facturas
      .filter((f) => {
        const est = String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "").toLowerCase();
        return est === "aprobada" || est === "completada";
      })
      .reduce((s, f) => s + parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0")), 0),
    [facturas]
  );

  // Facturas pendientes de aprobación (para informar, no para el saldo)
  const totalEnRevision = useMemo(
    () => facturas
      .filter((f) => {
        const est = String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "").toLowerCase();
        return est === "pendiente" || est === "";
      })
      .reduce((s, f) => s + parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0")), 0),
    [facturas]
  );

  // Saldo real = recibido − aprobado (solo facturas con estado Aprobada/Completada)
  const saldo = totalRecibido - totalAprobado;

  const ultimasEntregas = useMemo(() => {
    const key = (e: EntregaItem) => {
      const f = String(getCellCaseInsensitive(e, "Fecha_Entrega", "Fecha") || "");
      if (/^\d{4}-\d{2}-\d{2}/.test(f)) return new Date(f).getTime();
      const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`).getTime();
      return new Date(f).getTime() || 0;
    };
    return [...entregas].sort((a, b) => key(b) - key(a)).slice(0, 3);
  }, [entregas]);
  const ultimasFacturas = useMemo(() => {
    const key = (f: FacturaItem) => {
      const fc = String(getCellCaseInsensitive(f, "FechaCreacion", "Fecha_ISO") || "");
      const tFc = fc ? new Date(fc).getTime() : NaN;
      if (Number.isFinite(tFc)) return tFc;
      const fd = String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
      if (/^\d{4}-\d{2}-\d{2}/.test(fd)) return new Date(fd).getTime() || 0;
      const m = fd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`).getTime() || 0;
      return new Date(fd).getTime() || 0;
    };
    return [...facturas].sort((a, b) => key(b) - key(a)).slice(0, 3);
  }, [facturas]);

  return (
    <div className="space-y-4">

      {/* ── PERFIL ── */}
      <Card className="glass-strong text-foreground">
        <CardContent className="pt-6 flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-border">
            <AvatarFallback className="glass text-foreground">{initials(String(user.name || "MiCaja"))}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.cargo || "Sin cargo"}</p>
            <p className="text-xs text-muted-foreground">{user.area || "Sin area"} · {user.sector || "Sin sector"}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 3 MÉTRICAS ── */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => <div key={i} className="h-24 animate-pulse glass" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass p-4">
            <p className="text-xs text-muted-foreground mb-1">💸 Recibido</p>
            <p className="text-lg font-bold text-foreground">{formatCOP(totalRecibido)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total entregado</p>
          </div>
          <div className="glass p-4">
            <p className="text-xs text-muted-foreground mb-1">🧾 Aprobado</p>
            <p className="text-lg font-bold text-foreground">{formatCOP(totalAprobado)}</p>
            <p className="text-xs text-muted-foreground mt-1">Facturas aprobadas</p>
          </div>
          <div className="glass p-4">
            <p className="text-xs text-muted-foreground mb-1">
              {saldo >= 0 ? "✅ Total" : "🔴 Excedido"}
            </p>
            <p className={`text-lg font-bold ${saldo >= 0 ? "text-success" : "text-danger"}`}>
              {formatCOP(Math.abs(saldo))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {saldo >= 0 ? "disponible" : "gastaste de más"}
            </p>
          </div>
        </div>
      )}

      {/* ── ALERTA ── */}
      {!loading && saldo > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-warning">
            ⚠️ Tienes <span className="font-bold">{formatCOP(saldo)}</span> pendiente por legalizar
          </p>
        </div>
      )}
      {!loading && saldo < 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-danger">
            🔴 Tus facturas aprobadas superan lo recibido por <span className="font-bold">{formatCOP(Math.abs(saldo))}</span>
          </p>
        </div>
      )}
      {!loading && saldo === 0 && totalRecibido > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-success">✅ Todo legalizado — estás al día</p>
        </div>
      )}
      {!loading && totalEnRevision > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <p className="text-sm text-info">
            ⏳ <span className="font-bold">{formatCOP(totalEnRevision)}</span> en facturas pendientes de aprobación
          </p>
        </div>
      )}

      {/* ── ÚLTIMAS ENTREGAS ── */}
      <Card className="glass-strong text-foreground">
        <CardHeader><CardTitle className="text-base">Últimas entregas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasEntregas.length ? ultimasEntregas.map((e, i) => (
                  <TableRow key={`ent-${i}`} className="border-border">
                    <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha", "Fecha_Entrega"))}</TableCell>
                    <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")))}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={2} className="text-muted-foreground">Sin entregas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── ÚLTIMAS FACTURAS ── */}
      <Card className="glass-strong text-foreground">
        <CardHeader><CardTitle className="text-base">Últimas facturas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Fecha</TableHead>
                  <TableHead className="text-muted-foreground">Proveedor</TableHead>
                  <TableHead className="text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-muted-foreground">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasFacturas.length ? ultimasFacturas.map((f, i) => {
                  const estado = String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
                  return (
                    <TableRow key={`fac-${i}`} className="border-border">
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}</TableCell>
                      <TableCell>{String(getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—")}</TableCell>
                      <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor")))}</TableCell>
                      <TableCell><Badge variant="outline">{estado}</Badge></TableCell>
                    </TableRow>
                  );
                }) : <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sin facturas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}