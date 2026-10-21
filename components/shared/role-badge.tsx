import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  admin: "border-foreground bg-foreground text-background",
  coordinador: "border-foreground/20 bg-foreground/10 text-foreground",
  verificador: "border-border bg-muted text-muted-foreground",
  user: "border-border bg-muted text-muted-foreground",
};

export function RoleBadge({ rol }: { rol: string }) {
  const r = rol.toLowerCase();
  return (
    <Badge className={cn("capitalize text-xs", COLORS[r] || COLORS.user)} variant="outline">
      {r}
    </Badge>
  );
}
