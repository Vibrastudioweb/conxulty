"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey, NavItem } from "./nav-config";

const ICONS: Record<NavIconKey, LucideIcon> = {
  hoy: Sun,
  agenda: CalendarDays,
  pacientes: Users,
  admin: ShieldCheck,
  staff: ClipboardList,
};

/**
 * Único componente que sabe qué sección está activa (necesita `usePathname`,
 * por eso es el Client Component; Sidebar y BottomNav son Server Components
 * que solo lo componen). Resuelve `iconKey` -> ícono localmente porque un
 * componente de ícono no puede pasarse como prop desde un Server Component.
 * Comparte la misma lógica de "activo" entre desktop y mobile para que
 * nunca diverjan.
 */
export function NavList({
  items,
  variant,
}: {
  items: NavItem[];
  variant: "sidebar" | "bottom";
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "bottom") {
    return (
      <>
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = ICONS[item.iconKey];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-caption font-medium transition ${
                active ? "text-brand-primary" : "text-text-faint"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = ICONS[item.iconKey];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3.5 rounded-button px-3 py-3 text-body transition ${
                active
                  ? "bg-brand-primary-soft font-semibold text-brand-primary"
                  : "font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }`}
            >
              <Icon size={24} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
