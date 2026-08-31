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
        className="text-xs text-text-faint hover:text-text-secondary"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
