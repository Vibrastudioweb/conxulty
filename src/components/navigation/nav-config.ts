import type { RolUsuario } from "@prisma/client";

export type NavIconKey = "hoy" | "agenda" | "pacientes" | "caja" | "admin" | "staff";

export interface NavItem {
  href: string;
  label: string;
  /**
   * Clave serializable, no el componente de ícono en sí: estos items se
   * pasan desde Server Components (Sidebar/AppShell/BottomNav) hacia
   * NavList, que es Client Component — un componente/función no puede
   * cruzar esa frontera como prop. NavList resuelve iconKey -> ícono
   * localmente, en su propio bundle de cliente.
   */
  iconKey: NavIconKey;
  /** Aparece en el tab bar mobile además del sidebar desktop. */
  primary?: boolean;
}

/**
 * Fuente única de la navegación del shell — ninguna pantalla debe declarar
 * su propio menú. Los ítems son por rol porque MEDICO/ADMIN/STAFF hoy no
 * comparten ninguna pantalla (ver requireMedico/autorizacion.ts); cuando
 * Admin/Staff crezcan más allá de su página placeholder, sus items se
 * amplían aquí sin tocar AppShell/Sidebar/BottomNav.
 */
const NAV_MEDICO: NavItem[] = [
  { href: "/hoy", label: "Hoy", iconKey: "hoy", primary: true },
  { href: "/agenda", label: "Agenda", iconKey: "agenda", primary: true },
  { href: "/pacientes", label: "Pacientes", iconKey: "pacientes", primary: true },
  { href: "/caja", label: "Caja", iconKey: "caja", primary: true },
];

const NAV_ADMIN: NavItem[] = [
  { href: "/admin", label: "Admin", iconKey: "admin", primary: true },
  { href: "/caja", label: "Caja", iconKey: "caja", primary: true },
];

const NAV_STAFF: NavItem[] = [
  { href: "/staff", label: "Staff", iconKey: "staff", primary: true },
  { href: "/caja", label: "Caja", iconKey: "caja", primary: true },
];

const NAV_SUPERADMIN: NavItem[] = [
  { href: "/superadmin", label: "Solicitudes", iconKey: "admin", primary: true },
];

export function navForRol(rol: RolUsuario): NavItem[] {
  switch (rol) {
    case "MEDICO":
      return NAV_MEDICO;
    case "ADMIN":
      return NAV_ADMIN;
    case "STAFF":
      return NAV_STAFF;
    case "SUPERADMIN":
      return NAV_SUPERADMIN;
    default:
      return [];
  }
}
