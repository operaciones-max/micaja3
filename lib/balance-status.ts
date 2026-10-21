/** balance = recibido − gastado (solo facturas aprobadas). Positivo: dinero disponible del técnico; negativo: empresa debe reembolso. */
export function balanceStatusTone(balance: number): { label: string; cls: string } {
  if (balance > 0) {
    return { label: "Tiene disponible", cls: "text-foreground" };
  }
  if (balance < 0) {
    return { label: "Empresa le debe", cls: "text-danger" };
  }
  return { label: "Al día", cls: "text-muted-foreground" };
}
