import Link from "next/link";
import { requireMedico } from "@/modules/core/autorizacion";
import { buscarPacientes, listarPacientes } from "@/modules/core/pacientes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; incluirArchivados?: string }>;
}) {
  const session = await requireMedico();
  const { q, pagina: paginaParam, incluirArchivados: incluirArchivadosParam } =
    await searchParams;

  const pagina = Number(paginaParam ?? "1") || 1;
  const incluirArchivados = incluirArchivadosParam === "1";

  const { items: pacientes, haySiguiente } = q
    ? await buscarPacientes({
        organizacionId: session.user.organizacionId,
        texto: q,
        pagina,
        incluirInactivos: incluirArchivados,
      })
    : await listarPacientes({
        organizacionId: session.user.organizacionId,
        pagina,
        incluirInactivos: incluirArchivados,
      });

  const parametrosBase = new URLSearchParams();
  if (q) parametrosBase.set("q", q);
  if (incluirArchivados) parametrosBase.set("incluirArchivados", "1");

  function hrefPagina(destino: number) {
    const params = new URLSearchParams(parametrosBase);
    params.set("pagina", String(destino));
    return `/pacientes?${params.toString()}`;
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        title="Pacientes"
        action={
          <Link
            href="/pacientes/nuevo"
            className="rounded-button bg-brand-primary px-4 py-2 text-body-secondary font-semibold text-white transition hover:bg-brand-primary-hover"
          >
            + Nuevo paciente
          </Link>
        }
        context={
          <Link href="/hoy" className="text-sm text-brand-primary hover:underline">
            ← Volver a Hoy
          </Link>
        }
      />

      <form method="get" className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, apellido o documento"
          className="max-w-sm"
        />
        <label className="flex items-center gap-1.5 text-caption text-text-secondary">
          <input
            type="checkbox"
            name="incluirArchivados"
            value="1"
            defaultChecked={incluirArchivados}
          />
          Incluir archivados
        </label>
        <button
          type="submit"
          className="rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
        >
          Buscar
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {pacientes.length === 0 && (
          <li>
            <EmptyState message={q ? "Sin resultados." : "Aún no hay pacientes."} />
          </li>
        )}
        {pacientes.map((paciente) => (
          <li key={paciente.id}>
            <Card href={`/pacientes/${paciente.id}`}>
              <div className="flex items-center justify-between gap-3">
                <span>
                  {paciente.nombre} {paciente.apellido}
                  {paciente.documentoIdentidad && (
                    <span className="ml-2 text-caption text-text-faint">
                      {paciente.documentoIdentidad}
                    </span>
                  )}
                </span>
                {!paciente.activo && <Badge tone="neutral">Archivado</Badge>}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {(pagina > 1 || haySiguiente) && (
        <div className="mt-4 flex items-center justify-between gap-2">
          {pagina > 1 ? (
            <Link
              href={hrefPagina(pagina - 1)}
              className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          {haySiguiente && (
            <Link
              href={hrefPagina(pagina + 1)}
              className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
