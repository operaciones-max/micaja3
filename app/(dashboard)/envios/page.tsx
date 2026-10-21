import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { EnviosCoordinadorClient } from "@/components/coordinador/envios-coordinador-client";
import { zonaDeOperacion } from "@/lib/coordinador-zona";

export default async function EnviosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/");
  // Una zona, o "Todas" para un coordinador multizona (puede enviar a técnicos de Bogotá y Costa Caribe).
  const sector = zonaDeOperacion(session.user);
  const uploadResponsableFallback = String(session.user?.responsable || session.user?.name || "").trim();
  return (
    <EnviosCoordinadorClient sector={sector} uploadResponsableFallback={uploadResponsableFallback} />
  );
}
