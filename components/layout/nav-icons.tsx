import { cn } from "@/lib/utils";

export type NavIconName =
  | "dashboard"
  | "zona"
  | "envios"
  | "facturas"
  | "reporte"
  | "gastos"
  | "usuarios"
  | "legalizaciones"
  | "reportes"
  | "inicio"
  | "entregas"
  | "mas";

/**
 * Íconos propios de la navegación: trazo fino de 1.5, esquinas redondeadas y una micro-animación
 * por ícono. Las animaciones están en globals.css (`.nav-ico`) y se disparan con el cursor sobre
 * un `.nav-hover` (barra lateral) o cuando el enlace pasa a ser la página actual en un `.nav-active`
 * (barra móvil).
 */
export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-ico={name}
      className={cn("nav-ico size-[22px] shrink-0", className)}
    >
      {ICONOS[name]}
    </svg>
  );
}

// pathLength=1 permite "dibujar" los trazos con stroke-dashoffset sin medir cada uno
const ICONOS: Record<NavIconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect className="q1" x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect className="q2" x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect className="q3" x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect className="q4" x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  zona: (
    <>
      <path className="pin" d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21z" />
      <circle className="dot" cx="12" cy="10.5" r="2.2" />
    </>
  ),
  envios: (
    <g className="plane">
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3l-6.5 18-4-8.5L2 8.5 21 3z" />
    </g>
  ),
  facturas: (
    <>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5z" />
      <path d="M14 3v5h5" />
      <path className="l1" pathLength={1} d="M9 13h6" />
      <path className="l2" pathLength={1} d="M9 17h4" />
    </>
  ),
  reporte: (
    <>
      <path d="M3.5 20.5h17" />
      <path className="b1" d="M7 20.5v-6" />
      <path className="b2" d="M12 20.5V7.5" />
      <path className="b3" d="M17 20.5v-9" />
    </>
  ),
  gastos: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path className="l1" pathLength={1} d="M9 8h6" />
      <path className="l2" pathLength={1} d="M9 12h6" />
    </>
  ),
  usuarios: (
    <>
      <circle className="h1" cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle className="h2" cx="17" cy="9" r="2.4" />
      <path d="M17.5 14.6c2.3.3 3.8 2 3.8 4.4" />
    </>
  ),
  legalizaciones: (
    <>
      <path d="M12 4v16" />
      <path d="M8 20.5h8" />
      <g className="beam">
        <path d="M5 8h14" />
        <path d="M5 8l-2.5 6a2.5 2.5 0 0 0 5 0L5 8z" />
        <path d="M19 8l-2.5 6a2.5 2.5 0 0 0 5 0L19 8z" />
      </g>
    </>
  ),
  reportes: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9.5 4V3h5v1" />
      <path className="ck" pathLength={1} d="m9 13.5 2.2 2.2L15.5 11" />
    </>
  ),
  inicio: (
    <>
      <path className="roof" d="M3.5 11 12 3.5 20.5 11" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V10" />
    </>
  ),
  entregas: (
    <>
      <path d="M3.5 8v8L12 20.5 20.5 16V8" />
      <path d="M12 12v8.5" />
      <path className="lid" d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8z" />
    </>
  ),
  mas: (
    <>
      <circle className="d1" cx="5.5" cy="12" r="1.2" />
      <circle className="d2" cx="12" cy="12" r="1.2" />
      <circle className="d3" cx="18.5" cy="12" r="1.2" />
    </>
  ),
};
