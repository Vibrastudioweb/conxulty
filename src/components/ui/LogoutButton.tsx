import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

async function cerrarSesion() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export function LogoutButton() {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 text-caption text-text-faint transition hover:text-text-secondary"
      >
        <LogOut size={14} aria-hidden="true" />
        Cerrar sesión
      </button>
    </form>
  );
}
