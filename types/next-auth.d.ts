import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    rol?: string;
    area?: string;
    sector?: string;
    cargo?: string;
    responsable?: string;
    cedula?: string;
    telefono?: string;
  }

  interface Session {
    user: {
      rol?: string;
      responsable?: string;
      area?: string;
      sector?: string;
      cargo?: string;
      cedula?: string;
      telefono?: string;
      /** Zona sobre la que opera: "Todas" (admin y coordinadores multizona) o su sector. */
      zona?: string;
      /** Puede editar cualquier factura (cualquier responsable y estado). */
      editaTodo?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: string;
    responsable?: string;
    area?: string;
    sector?: string;
    cargo?: string;
    cedula?: string;
    telefono?: string;
    email?: string;
    zona?: string;
    editaTodo?: boolean;
  }
}
