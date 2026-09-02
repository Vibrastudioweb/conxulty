import { NotFoundPanel } from "@/components/feedback/NotFoundPanel";

export default function DashboardNotFound() {
  return (
    <NotFoundPanel
      title="No encontrado"
      message="No encontramos lo que buscabas."
      backHref="/"
      backLabel="Volver al inicio"
    />
  );
}
