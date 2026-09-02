import { NotFoundPanel } from "@/components/feedback/NotFoundPanel";

export default function PacienteNotFound() {
  return (
    <NotFoundPanel
      title="Paciente no encontrado"
      message="Es posible que el paciente no exista o no pertenezca a tu organización."
      backHref="/pacientes"
      backLabel="Volver a Pacientes"
    />
  );
}
