import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createSignedUploadUrlForPath, publicUrlForPath } from "@/lib/storage-supabase";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heic"],
  ["application/pdf", "pdf"],
]);

const MAX_BYTES = 10 * 1024 * 1024;
const VALID_SECTORS = new Set(["Bogota", "Costa Caribe"]);

function folderYearMonth(fecha: string | null): string {
  if (!fecha?.trim()) return new Date().toISOString().slice(0, 7);
  const t = fecha.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(0, 7);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "user" && rol !== "coordinador" && rol !== "admin")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      mime?: unknown;
      size?: unknown;
      destino?: unknown;
      sector?: unknown;
      responsable?: unknown;
      fecha?: unknown;
    };

    const mimeStr = String(body.mime || "").toLowerCase();
    const ext = ALLOWED.get(mimeStr);
    if (!ext)
      return NextResponse.json(
        { error: "Tipo no permitido. Use JPG, PNG, WebP o PDF." },
        { status: 400 }
      );

    const sizeNum = Number(body.size || 0);
    if (sizeNum > MAX_BYTES)
      return NextResponse.json({ error: "El archivo supera 10MB" }, { status: 400 });

    const destino = String(body.destino || "").trim();
    const isReportes = destino === "reportes";
    const isEnvios = destino === "envios";
    const isGastos = destino === "gastos";

    const sessionSector = String(session.user.sector || "").trim();
    let sector = String(body.sector || "").trim();

    if (isReportes) {
      if (rol !== "admin")
        return NextResponse.json(
          { error: "Solo el administrador puede subir PDFs de reportes" },
          { status: 403 }
        );
      sector = VALID_SECTORS.has(sessionSector) ? sessionSector : "Bogota";
    } else if (isGastos) {
      sector = VALID_SECTORS.has(sessionSector) ? sessionSector : "Bogota";
    } else if (!VALID_SECTORS.has(sector)) {
      return NextResponse.json(
        { error: 'sector debe ser "Bogota" o "Costa Caribe"' },
        { status: 400 }
      );
    }

    if (!isReportes && !isGastos) {
      if ((rol === "user" || rol === "coordinador") && sessionSector && sector !== sessionSector)
        return NextResponse.json(
          { error: "El sector no coincide con su cuenta" },
          { status: 403 }
        );
    }

    const responsable = String(
      body.responsable || session.user.responsable || session.user.name || ""
    ).trim();
    if (!responsable)
      return NextResponse.json({ error: "Falta responsable" }, { status: 400 });

    const fecha = String(body.fecha || "").trim();
    const yyyyMm = folderYearMonth(fecha || null);
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
      now.getMinutes()
    ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const safeName = responsable.replace(/\s+/g, "_").slice(0, 120) || "usuario";
    const fileName = `${stamp}_${safeName}.${ext}`;

    const storagePath = isReportes
      ? `reportes/${sector}/${fileName}`
      : isEnvios
        ? `envios/${sector}/${yyyyMm}/${fileName}`
        : isGastos
          ? `gastos/${sector}/${yyyyMm}/${fileName}`
          : `facturas/${sector}/${yyyyMm}/${fileName}`;

    const { signedUrl, token } = await createSignedUploadUrlForPath(storagePath);
    const publicUrl = publicUrlForPath(storagePath);

    return NextResponse.json({ signedUrl, token, path: storagePath, publicUrl, fileName });
  } catch (e) {
    console.error("facturas/upload-url POST:", e);
    return NextResponse.json({ error: "Error generando URL de subida" }, { status: 500 });
  }
}
