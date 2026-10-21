"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import {
  LayoutDashboard,
  FileText,
  Users,
  Send,
  BarChart3,
  ClipboardList,
  Home,
  Package,
  Receipt,
  Scale,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function navByRole(rol: string): NavItem[] {
  if (rol === "admin") {
    return [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/reportes", label: "Reportes", icon: ClipboardList },
      { href: "/admin/facturas", label: "Facturas", icon: FileText },
      { href: "/gastos", label: "Gastos Generales", icon: Receipt },
      { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    ];
  }
  if (rol === "coordinador") {
    return [
      { href: "/", label: "Mi Zona", icon: Users },
      { href: "/envios", label: "Envíos", icon: Send },
      { href: "/facturas", label: "Facturas", icon: FileText },
      { href: "/reporte", label: "Reporte", icon: BarChart3 },
      { href: "/gastos", label: "Gastos Generales", icon: Receipt },
      { href: "/usuarios-zona", label: "Usuarios", icon: Users },
      { href: "/legalizaciones", label: "Legalizaciones", icon: Scale },
    ];
  }
  return [
    { href: "/mi-cuenta", label: "Mi Cuenta", icon: Home },
    { href: "/facturas", label: "Facturas", icon: FileText },
    { href: "/entregas", label: "Entregas", icon: Package },
  ];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "B";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function SidebarNav({
  session,
  className,
}: {
  session: Session;
  className?: string;
}) {
  const pathname = usePathname();
  const rol = String(session.user?.rol || "user").toLowerCase();
  const items = navByRole(rol);
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ top: number; height: number } | null>(null);

  // El indicador se desliza hasta la opción activa
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setInd(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  }, [pathname, rol]);
  const user = session.user;
  const nombre = user?.name || user?.email || "Usuario";
  const cargo = user?.cargo || user?.sector || "";

  return (
    <aside
      className={cn(
        "flex h-full min-h-screen w-64 flex-col border-r border-border glass-bar",
        className
      )}
    >
      <div className="group flex items-center gap-2 border-b border-border p-6">
        <Logo
          size={36}
          className="transition-transform duration-500 ease-[var(--spring)] group-hover:-rotate-6 group-hover:scale-105"
        />
        <div>
          <span className="text-lg font-bold tracking-wide text-foreground">Bia</span>
          <p className="text-xs text-muted-foreground">{process.env.NEXT_PUBLIC_APP_NAME || "MiCaja"}</p>
        </div>
      </div>

      <nav ref={navRef} className="relative flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-0 rounded-full bg-[var(--glass-strong)] shadow-[var(--shadow),inset_0_1px_0_var(--rim-a)] transition-[transform,height,opacity] duration-[600ms] ease-[var(--spring)]"
          style={{
            height: ind?.height ?? 0,
            opacity: ind ? 1 : 0,
            transform: `translateY(${ind?.top ?? 0}px)`,
          }}
        />
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group/nav relative z-10 mx-3 flex min-h-[44px] items-center gap-3 rounded-full px-4 py-3 text-sm transition-colors duration-300",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-500 ease-[var(--spring)]",
                  active ? "scale-110" : "group-hover/nav:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bia-aqua/20 text-sm font-bold text-bia-aqua">
            {initials(nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{cargo || "—"}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="shrink-0 text-muted-foreground transition-colors hover:text-bia-aqua"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
