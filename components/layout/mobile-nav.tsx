"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { LayoutDashboard, FileText, Package, Send, MoreHorizontal, FileBarChart2 } from "lucide-react";

const SHORT_USER: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/mi-cuenta", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/entregas", label: "Entregas", icon: Package },
];

const SHORT_COORD: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/", label: "Zona", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/envios", label: "Envíos", icon: Send },
];

const SHORT_ADMIN: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/facturas", label: "Facturas", icon: FileText },
  { href: "/admin/reportes", label: "Reportes", icon: FileBarChart2 },
];

function allowedRoutesByRole(rol: string): string[] {
  if (rol === "admin")
    return ["/admin", "/admin/reportes", "/admin/facturas", "/admin/usuarios"];
  if (rol === "coordinador") return ["/", "/envios", "/facturas", "/reporte", "/legalizaciones"];
  return ["/mi-cuenta", "/facturas", "/entregas"];
}

/** Barra de pestañas flotante de cristal; una burbuja se desliza hasta la pestaña activa. */
export function MobileBottomNav({ session }: { session: Session }) {
  const pathname = usePathname();
  const rol = String(session.user?.rol || "user").toLowerCase();
  const allowed = new Set(allowedRoutesByRole(rol));
  const shortList =
    rol === "admin" ? SHORT_ADMIN : rol === "coordinador" ? SHORT_COORD : SHORT_USER;
  const tabs = shortList.filter((s) => allowed.has(s.href));
  const shortTabs = tabs.length
    ? tabs
    : [
        {
          href: rol === "admin" ? "/admin" : rol === "coordinador" ? "/" : "/mi-cuenta",
          label: "Inicio",
          icon: LayoutDashboard,
        },
      ];
  const moreHref =
    Array.from(allowed).find((href) => !shortTabs.some((s) => s.href === href)) ||
    (rol === "admin" ? "/admin" : "/");

  const total = shortTabs.length + 1;
  // Gana la pestaña cuya ruta coincide de forma más específica (p. ej. /admin/facturas sobre /admin)
  const activeIdx =
    shortTabs
      .map(({ href }, i) => ({
        i,
        len: href.length,
        ok: href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"),
      }))
      .filter((m) => m.ok)
      .sort((a, b) => b.len - a.len)[0]?.i ?? -1;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="glass glass-dock relative grid rounded-full p-1.5" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-1.5 rounded-full bg-[var(--glass-strong)] shadow-[0_6px_18px_-6px_rgba(0,0,0,0.28),inset_0_1px_0_var(--rim-a)] transition-[transform,opacity] duration-[650ms] ease-[var(--spring)]"
          style={{
            width: `calc((100% - 12px) / ${total})`,
            opacity: activeIdx >= 0 ? 1 : 0,
            transform: `translateX(${Math.max(activeIdx, 0) * 100}%)`,
          }}
        />
        {shortTabs.map(({ href, label, icon: Icon }, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition-colors duration-300",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-transform duration-[550ms] ease-[var(--spring)]",
                  active && "-translate-y-px scale-110"
                )}
              />
              {label}
            </Link>
          );
        })}
        <Link
          href={moreHref === pathname ? (rol === "admin" ? "/admin" : "/") : moreHref}
          className="relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold text-muted-foreground"
        >
          <MoreHorizontal className="h-[22px] w-[22px]" />
          Más
        </Link>
      </div>
    </nav>
  );
}
