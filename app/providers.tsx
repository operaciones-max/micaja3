"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { PointerGlow } from "@/components/shared/pointer-glow";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PointerGlow />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
