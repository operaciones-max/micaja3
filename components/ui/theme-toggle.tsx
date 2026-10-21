"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme, type ThemeOrigin } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER: Theme[] = ["system", "dark", "light"];

const ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

const LABELS = {
  dark: "Oscuro",
  light: "Claro",
  system: "Auto",
} as const;

function originOf(e: React.MouseEvent<HTMLElement>): ThemeOrigin {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 };
}

/**
 * Selector de tema. Escritorio: control segmentado con pulgar que se desliza.
 * Móvil (`iconOnly`): un botón que cicla Auto → Oscuro → Claro. En ambos, el cambio se revela en círculo.
 */
export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (iconOnly) {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    const Icon = ICONS[theme];
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => setTheme(next, originOf(e))}
        aria-label={`Tema: ${LABELS[theme]}. Clic para cambiar a ${LABELS[next]}`}
        title={`Tema: ${LABELS[theme]}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }

  const idx = Math.max(0, ORDER.indexOf(theme));
  return (
    <div
      role="group"
      aria-label="Tema"
      className="relative inline-grid grid-cols-3 rounded-full bg-foreground/[0.07] p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-card shadow-[0_2px_8px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-[600ms] ease-[var(--spring)] dark:bg-foreground/20"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      {ORDER.map((t) => {
        const Icon = ICONS[t];
        const active = t === theme;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            aria-label={LABELS[t]}
            title={LABELS[t]}
            onClick={(e) => setTheme(t, originOf(e))}
            className={cn(
              "relative z-10 grid size-8 place-items-center rounded-full transition-colors duration-300",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
