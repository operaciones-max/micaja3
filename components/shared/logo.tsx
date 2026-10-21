import Image from "next/image";
import { cn } from "@/lib/utils";

/** Isotipo de MiCaja: rayo blanco sobre negro con esquinas del 22 %. */
export function Logo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Logo de MiCaja"
      width={size}
      height={size}
      priority
      unoptimized
      className={cn("shrink-0 rounded-[22%] shadow-sm ring-1 ring-inset ring-white/15", className)}
    />
  );
}
