import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

async function cerrarSesion() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "text" }) {
  if (variant === "text") {
    return (
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="block text-body-secondary text-danger transition hover:text-danger-text"
        >
          Cerrar sesión
        </button>
      </form>
    );
  }

  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        title="Cerrar sesión"
        className="inline-flex items-center gap-1.5 text-caption text-text-faint transition hover:text-text-secondary"
      >
        <LogOut size={14} aria-hidden="true" />
        <span className="group-data-[collapsed=true]/sidebar:hidden">Cerrar sesión</span>
      </button>
    </form>
  );
}
