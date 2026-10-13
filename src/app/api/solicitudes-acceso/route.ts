import { crearSolicitudAcceso } from "@/modules/solicitudes";

/**
 * POST /api/solicitudes-acceso — endpoint público para el formulario del
 * landing (conxulty.com). Acepta JSON o application/x-www-form-urlencoded /
 * multipart. No crea usuarios ni organizaciones: solo registra la solicitud.
 *
 * CORS: solo responde a los orígenes permitidos (por defecto conxulty.com y
 * www.conxulty.com; ampliar con SOLICITUDES_ALLOWED_ORIGINS, separados por
 * coma). No usa cookies ni credenciales.
 */

function origenesPermitidos(): string[] {
  const extra = (process.env.SOLICITUDES_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return ["https://conxulty.com", "https://www.conxulty.com", ...extra];
}

function cabecerasCors(request: Request): Record<string, string> {
  const origen = request.headers.get("origin");
  const base: Record<string, string> = { Vary: "Origin" };
  if (origen && origenesPermitidos().includes(origen)) {
    base["Access-Control-Allow-Origin"] = origen;
    base["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    base["Access-Control-Allow-Headers"] = "Content-Type";
    base["Access-Control-Max-Age"] = "600";
  }
  return base;
}

function json(request: Request, cuerpo: unknown, status: number) {
  return Response.json(cuerpo, { status, headers: cabecerasCors(request) });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cabecerasCors(request) });
}

export async function POST(request: Request) {
  // Evita cuerpos enormes en un endpoint público.
  const largo = Number(request.headers.get("content-length") ?? "0");
  if (largo > 10_000) {
    return json(request, { ok: false, error: "Solicitud demasiado grande." }, 413);
  }

  let crudo: Record<string, unknown> = {};
  const tipo = request.headers.get("content-type") ?? "";
  try {
    if (tipo.includes("application/json")) {
      const cuerpo = await request.json();
      if (cuerpo && typeof cuerpo === "object") {
        crudo = cuerpo as Record<string, unknown>;
      }
    } else {
      const form = await request.formData();
      crudo = Object.fromEntries(
        Array.from(form.entries()).filter(([, v]) => typeof v === "string"),
      );
    }
  } catch {
    return json(request, { ok: false, error: "Cuerpo inválido." }, 400);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida";

  const resultado = await crearSolicitudAcceso(
    {
      nombre: crudo.nombre,
      email: crudo.email,
      telefono: crudo.telefono,
      especialidad: crudo.especialidad || undefined,
      nombreConsultorio: crudo.nombreConsultorio,
    },
    {
      ip,
      honeypot: typeof crudo.sitioWeb === "string" ? crudo.sitioWeb : null,
    },
  );

  switch (resultado.estado) {
    case "invalida":
      return json(request, { ok: false, campos: resultado.campos }, 400);
    case "limite":
      return json(
        request,
        { ok: false, error: "Demasiados intentos. Espera unos minutos." },
        429,
      );
    default:
      // creada | duplicada | ignorada → misma respuesta (no filtra información).
      return json(request, { ok: true }, 201);
  }
}
