/**
 * Sube un archivo directo a Supabase Storage via presigned URL.
 * Evita el límite de 4.5 MB de Vercel Functions pasando el archivo
 * directamente desde el navegador al bucket.
 */
export async function uploadFileToStorage(
  file: File | Blob,
  params: {
    mime: string;
    size: number;
    destino?: string;
    sector?: string;
    responsable?: string;
    fecha?: string;
  }
): Promise<{ url: string; fileId: string; fileName: string }> {
  const urlRes = await fetch("/api/facturas/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const urlJson = (await urlRes.json().catch(() => ({}))) as {
    signedUrl?: string;
    publicUrl?: string;
    path?: string;
    fileName?: string;
    error?: string;
  };
  if (!urlRes.ok || !urlJson.signedUrl || !urlJson.publicUrl || !urlJson.path) {
    throw new Error(urlJson.error || "Error al preparar subida");
  }

  const putRes = await fetch(urlJson.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": params.mime },
    body: file,
  });
  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => "");
    throw new Error(`Error al subir archivo: HTTP ${putRes.status} ${txt}`.trim());
  }

  return { url: urlJson.publicUrl, fileId: urlJson.path, fileName: urlJson.fileName ?? "" };
}
