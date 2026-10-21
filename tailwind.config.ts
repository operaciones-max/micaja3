import type { Config } from "tailwindcss";

/** Color respaldado por una variable CSS "r g b" (permite modificadores de opacidad: /10, /20…). */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca en blanco y negro: la tinta se invierte entre claro y oscuro.
        brand: {
          DEFAULT: v("brand"),
          foreground: v("brand-foreground"),
        },
        // Alias heredados: apuntan a los tokens nuevos para que las clases `bia-*` existentes adopten el template.
        bia: {
          blue: v("background"),
          "blue-mid": v("card"),
          gray: v("muted-foreground"),
          "gray-light": v("muted-foreground"),
          aqua: v("brand"),
          purple: v("brand"),
          "purple-light": v("foreground"),
          white: "#FFFFFF",
        },
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        track: v("track"),
        // Colores semánticos: único uso de color (estados, saldos y alertas).
        success: v("success"),
        warning: v("warning"),
        danger: v("danger"),
        info: v("info"),
        orange: v("orange"),
        primary: {
          DEFAULT: v("primary"),
          foreground: v("primary-foreground"),
        },
        secondary: {
          DEFAULT: v("secondary"),
          foreground: v("secondary-foreground"),
        },
        destructive: {
          DEFAULT: v("destructive"),
          foreground: v("destructive-foreground"),
        },
        muted: {
          DEFAULT: v("muted"),
          foreground: v("muted-foreground"),
        },
        accent: {
          DEFAULT: v("accent"),
          foreground: v("accent-foreground"),
        },
        popover: {
          DEFAULT: v("popover"),
          foreground: v("popover-foreground"),
        },
        card: {
          DEFAULT: v("card"),
          foreground: v("card-foreground"),
        },
        sidebar: {
          DEFAULT: v("sidebar"),
          foreground: v("sidebar-foreground"),
          border: v("border"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "var(--font-sans)",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
