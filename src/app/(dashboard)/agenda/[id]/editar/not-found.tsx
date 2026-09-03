import { NotFoundPanel } from "@/components/feedback/NotFoundPanel";

export default function CitaNotFound() {
  return (
    <NotFoundPanel
      title="Cita no encontrada"
      message="Es posible que la cita no exista o no pertenezca a tu agenda."
      backHref="/agenda"
      backLabel="Volver a Agenda"
    />
  );
}
