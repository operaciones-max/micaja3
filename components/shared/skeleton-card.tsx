import { cn } from "@/lib/utils";

/** Tarjeta de cristal con líneas que brillan mientras carga el contenido. */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  const widths = ["40%", "78%", "55%", "65%"];
  return (
    <div className={cn("glass space-y-3 p-5", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <i
          key={i}
          className="shimmer block rounded-lg"
          style={{ width: widths[i % widths.length], height: i === 1 ? 26 : 14 }}
        />
      ))}
    </div>
  );
}
