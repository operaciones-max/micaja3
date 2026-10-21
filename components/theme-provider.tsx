"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "system" | "light" | "dark";

/** Punto de origen (en px de la ventana) del revelado circular al cambiar de tema. */
export type ThemeOrigin = { x: number; y: number };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme, origin?: ThemeOrigin) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "dark",
});

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(t: Theme) {
      const isDark = t === "dark" || (t === "system" && mq.matches);
      root.classList.toggle("dark", isDark);
      setResolvedTheme(isDark ? "dark" : "light");
    }

    apply(theme);

    if (theme === "system") {
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  function setTheme(t: Theme, origin?: ThemeOrigin) {
    const root = document.documentElement;
    const run = () => {
      const isDark =
        t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
      setThemeState(t);
      localStorage.setItem("theme", t);
    };

    const doc = document as ViewTransitionDoc;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduce || !origin) {
      run();
      return;
    }

    const transition = doc.startViewTransition(() => flushSync(run));
    transition.ready
      .then(() => {
        const { x, y } = origin;
        const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 700, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
