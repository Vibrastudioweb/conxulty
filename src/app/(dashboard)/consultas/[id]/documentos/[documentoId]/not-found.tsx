import { NotFoundPanel } from "@/components/feedback/NotFoundPanel";

export default function DocumentoNotFound() {
  return (
    <NotFoundPanel
      title="Documento no encontrado"
      message="Es posible que el documento no exista o no pertenezca a esta consulta."
      backHref="/hoy"
      backLabel="Volver a Hoy"
    />
  );
}
