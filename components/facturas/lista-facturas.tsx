"use client";

import { useId, useState } from "react";
import { ChevronDown, ImageIcon, ImageOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { facturaImageUrlForDisplay } from "@/lib/drive-image-url";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { cn } from "@/lib/utils";

type FacturaItem = Record<string, unknown>;

const celda = (f: FacturaItem, ...claves: string[]) => String(getCellCaseInsensitive(f, ...claves) || "");

function estadoVisual(estado: string): { punto: string; texto: string } {
  const e = estado.toLowerCase();
  if (e === "aprobada") return { punto: "bg-success", texto: "text-success" };
  if (e === "rechazada") return { punto: "bg-danger", texto: "text-danger" };
  if (e === "completada") return { punto: "bg-foreground/45", texto: "text-muted-foreground" };
  return { punto: "bg-warning", texto: "text-warning" };
}

const TONOS = {
  neutro: "text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
  ok: "bg-success/10 text-success hover:bg-success/20",
  peligro: "bg-danger/10 text-danger hover:bg-danger/20",
  suave: "text-muted-foreground hover:bg-danger/15 hover:text-danger",
} as const;

/** Botón redondo solo con ícono: el texto va en el tooltip y en la etiqueta accesible. */
export function AccionIcono({
  label,
  onClick,
  tono = "neutro",
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  tono?: keyof typeof TONOS;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full outline-none transition-[background-color,color,transform] duration-300 ease-[var(--spring)] hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-90 disabled:pointer-events-none disabled:opacity-40 md:size-8 [&_svg]:size-4 [&_svg]:stroke-[1.75]",
        TONOS[tono]
      )}
    >
      {children}
    </button>
  );
}

export function ListaFacturas({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-border/50">{children}</ul>;
}

export function FilasEsqueleto({ filas = 4 }: { filas?: number }) {
  return (
    <ul className="divide-y divide-border/50" aria-hidden>
      {Array.from({ length: filas }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-2 py-4">
          <i className="shimmer block h-4 flex-1 rounded-lg" style={{ maxWidth: `${55 + ((i * 13) % 30)}%` }} />
          <i className="shimmer block h-4 w-20 rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

/** Pie de la lista con el avance («Mostrando 40 de 3.009»); su `centinela` dispara la siguiente tanda. */
export function PieLista({
  mostradas,
  total,
  centinela,
  onMas,
}: {
  mostradas: number;
  total: number;
  centinela: React.MutableRefObject<HTMLDivElement | null>;
  onMas: () => void;
}) {
  if (mostradas >= total) return null;
  return (
    <div ref={centinela} className="flex items-center justify-center gap-3 py-4 text-xs text-muted-foreground">
      Mostrando {mostradas} de {total}
      <button
        type="button"
        onClick={onMas}
        className="rounded-full border border-border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-foreground/10"
      >
        Mostrar más
      </button>
    </div>
  );
}

export function SinFacturas({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * Una factura en una sola línea: proveedor (recortado con «…»), valor, estado y acciones.
 * El resto de los datos (NIT, ciudad, servicio, OPS…) se despliega al tocar la fila.
 */
export function FacturaFila({
  f,
  indice = 0,
  mostrarResponsable,
  mostrarZona,
  conSeleccion,
  seleccion,
  onVerImagen,
  acciones,
}: {
  f: FacturaItem;
  indice?: number;
  mostrarResponsable?: boolean;
  mostrarZona?: boolean;
  /** Reserva la columna del selector (aunque esta fila no se pueda seleccionar). */
  conSeleccion?: boolean;
  seleccion?: { checked: boolean; onToggle: () => void; label: string };
  onVerImagen: (src: string) => void;
  acciones?: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  // El detalle se crea la primera vez que se abre: oculto, sumaba ~30 elementos por fila a listas de miles
  const [montado, setMontado] = useState(false);
  const idDetalle = useId();

  function alternar() {
    if (abierta) return setAbierta(false);
    if (montado) return setAbierta(true);
    setMontado(true);
    // dos cuadros después, para que la transición parta de «cerrado»
    requestAnimationFrame(() => requestAnimationFrame(() => setAbierta(true)));
  }

  const proveedor = celda(f, "Proveedor", "Razon_Social") || "—";
  const responsable = celda(f, "Responsable");
  const servicio = celda(f, "ServicioDeclarado", "Tipo_servicio");
  const fecha = formatDateDDMMYYYY(celda(f, "Fecha", "Fecha_Factura"));
  const valor = formatCOP(parseCOPString(celda(f, "Valor", "Monto_Factura")));
  const estado = celda(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
  const motivo = celda(f, "MotivoRechazo");
  const autoAprobada = celda(f, "Observacion", "Concepto").includes("[AUTO]") && estado.toLowerCase() === "aprobada";
  const aBia = sheetANombreBiaTrue(celda(f, "ANombreBia", "AnombreBia", "NombreBia", "Nombre_bia"));
  const imgSrc = facturaImageUrlForDisplay(
    celda(f, "Adjuntar_Factura"),
    celda(f, "URL", "ImagenURL"),
    celda(f, "DriveFileId")
  );
  const visual = estadoVisual(estado);
  const meta = [mostrarResponsable ? responsable : "", servicio, fecha].filter(Boolean).join(" · ");

  const detalles: [string, string][] = [
    ["Proveedor", proveedor],
    ["NIT", celda(f, "NIT", "Nit_Factura")],
    ["Ciudad", celda(f, "Ciudad")],
    ["Servicio", servicio],
    ["Operación", celda(f, "OPS", "TipoOperacion")],
    ["Tipo de factura", celda(f, "TipoFactura", "Tipo_Factura")],
    ["A nombre de BIA", aBia ? "Sí" : "No"],
  ];
  if (mostrarResponsable) detalles.unshift(["Usuario", responsable]);
  if (mostrarZona) detalles.push(["Zona", etiquetaZona(celda(f, "Sector"))]);
  if (motivo) detalles.push(["Motivo del rechazo", motivo]);

  return (
    <li className="animate-[rise-sm_.5s_var(--ease)_backwards]" style={{ animationDelay: `${Math.min(indice, 10) * 28}ms` }}>
      <div
        className="factura-fila rounded-2xl px-2 py-2.5 transition-colors duration-300 hover:bg-foreground/[0.04]"
        data-sel={conSeleccion ? "" : undefined}
      >
        {conSeleccion ? (
          <div className="self-start pt-1 [grid-area:chk] md:self-center">
            {seleccion ? (
              <Checkbox checked={seleccion.checked} onCheckedChange={seleccion.onToggle} aria-label={seleccion.label} />
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={idDetalle}
          onClick={alternar}
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left outline-none [grid-area:main] focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="truncate text-sm font-semibold text-foreground" title={proveedor}>
            {proveedor}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-500 ease-[var(--spring)]",
              abierta && "rotate-180"
            )}
          />
        </button>

        <span
          className="cursor-pointer truncate text-xs text-muted-foreground [grid-area:meta]"
          title={meta}
          onClick={alternar}
        >
          {meta}
        </span>

        <span className="text-right text-sm font-semibold tabular-nums text-foreground [grid-area:valor]">{valor}</span>

        <div className="flex items-center justify-between gap-2 [grid-area:pie] md:contents">
          <span
            className={cn("inline-flex items-center gap-1.5 text-xs font-medium md:[grid-area:estado]", visual.texto)}
            title={motivo || undefined}
          >
            <i aria-hidden className={cn("size-1.5 shrink-0 rounded-full", visual.punto)} />
            {estado}
            {autoAprobada ? <span className="font-normal text-muted-foreground">· automática</span> : null}
          </span>

          <div className="flex items-center justify-end md:[grid-area:acciones]">
            {imgSrc ? (
              <AccionIcono label="Ver imagen" onClick={() => onVerImagen(imgSrc)}>
                <ImageIcon />
              </AccionIcono>
            ) : (
              <span title="Sin imagen disponible" className="inline-flex size-9 items-center justify-center text-muted-foreground/40 md:size-8">
                <ImageOff className="size-4 stroke-[1.75]" aria-label="Sin imagen disponible" />
              </span>
            )}
            {acciones}
          </div>
        </div>

        <div
          id={idDetalle}
          aria-hidden={!abierta}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease)] [grid-area:det]",
            abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            {montado ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-2 pt-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                {detalles.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words font-medium text-foreground">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
