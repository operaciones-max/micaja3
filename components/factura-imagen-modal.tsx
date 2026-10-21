"use client";
import { useEffect, useState } from "react";
import { Portal } from "@/components/shared/portal";

type Props = {
  src: string | null;
  onClose: () => void;
};

function isIframeForSrc(src: string): boolean {
  return (
    /\.pdf(\?|#|$)/i.test(src) ||
    src.includes("/view") ||
    /drive\.google\.com\/file\/d\//.test(src)
  );
}

function iframeSrcForFactura(src: string): string {
  const fileMatch = src.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  return src;
}

function proxyUrl(src: string): string {
  return `/api/proxy-imagen?url=${encodeURIComponent(src)}`;
}

/* eslint-disable @next/next/no-img-element */
export function FacturaImagenModal({ src, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const iframe = src ? isIframeForSrc(src) : false;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!mounted || !src) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
        <div className="relative w-full max-w-2xl overflow-hidden glass-strong" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">Imagen de factura</span>
            <div className="flex items-center gap-3">
              <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:underline">Abrir en Drive</a>
              <button type="button" onClick={onClose} className="text-lg text-muted-foreground hover:text-foreground">x</button>
            </div>
          </div>
          <div className="flex min-h-[300px] items-center justify-center bg-white p-2">
            {iframe ? (
              <iframe src={iframeSrcForFactura(src)} className="h-[500px] w-full border-0" title="Factura PDF" />
            ) : (
              <img src={proxyUrl(src)} alt="Factura" className="max-h-[500px] max-w-full object-contain" />
            )}
          </div>
          <div className="px-4 py-2 border-t border-border flex justify-between">
            <span className="text-xs text-muted-foreground">ESC para cerrar</span>
            <a href={src} download className="text-xs text-foreground hover:underline">Descargar</a>
          </div>
        </div>
      </div>
    </Portal>
  );
}
/* eslint-enable @next/next/no-img-element */