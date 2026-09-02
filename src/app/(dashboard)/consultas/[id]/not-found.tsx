import { NotFoundPanel } from "@/components/feedback/NotFoundPanel";

export default function ConsultaNotFound() {
  return (
    <NotFoundPanel
      title="Consulta no encontrada"
      message="Es posible que la consulta no exista o no esté disponible para ti."
      backHref="/hoy"
      backLabel="Volver a Hoy"
    />
  );
}
