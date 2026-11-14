"use server";

import { redirect } from "next/navigation";
import { requireMedicoSesion, requirePro } from "@/modules/core/autorizacion";
import {
  anularDocumento,
  DocumentoNoEncontradoError,
  DocumentoYaAnuladoError,
} from "@/modules/documentos/documentos";

/**
 * Anula una receta equivocada (ver `anularDocumento`). No la borra: el
 * documento se queda entero, marcado, con fecha y motivo.
 *
 * El motivo es obligatorio y viene del formulario; todo lo demás —quién
 * anula, de qué organización— sale de la sesión, nunca del cliente.
 */
export async function anularDocumentoAction(formData: FormData) {
  const { session } = await requireMedicoSesion();
  await requirePro("documentos");

  const documentoId = String(formData.get("documentoId") ?? "");
  const consultaId = String(formData.get("consultaId") ?? "");
  if (!documentoId || !consultaId) {
    throw new Error("Falta el documento.");
  }

  // Tope en el servidor: el maxLength del formulario no protege de una
  // petición armada a mano.
  const motivo = String(formData.get("motivoAnulacion") ?? "").trim().slice(0, 300);
  if (!motivo) {
    redirect(`/consultas/${consultaId}/documentos/${documentoId}?error=sin_motivo`);
  }

  try {
    await anularDocumento({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      documentoId,
      motivo,
    });
  } catch (err) {
    if (err instanceof DocumentoYaAnuladoError) {
      redirect(`/consultas/${consultaId}/documentos/${documentoId}?error=ya_anulado`);
    }
    if (err instanceof DocumentoNoEncontradoError) {
      redirect(`/consultas/${consultaId}`);
    }
    throw err;
  }

  redirect(`/consultas/${consultaId}/documentos/${documentoId}?anulado=1`);
}
