import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { CoordinadorDashboardClient } from "@/components/coordinador/coordinador-dashboard-client";
import { etiquetaZona, zonaDeOperacion } from "@/lib/coordinador-zona";

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/mi-cuenta");
  if (rol === "admin") redirect("/admin");
  if (rol === "coordinador") {
    // Una zona, o "Todas" para un coordinador multizona.
    const sector = zonaDeOperacion(session.user);
    return (
      <CoordinadorDashboardClient sector={sector} zonaLabel={etiquetaZona(sector)} />
    );
  }
  redirect("/mi-cuenta");
}
