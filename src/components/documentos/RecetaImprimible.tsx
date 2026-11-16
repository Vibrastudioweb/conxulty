import type { ContenidoReceta } from "@/modules/documentos/documentos";

/**
 * Formato de impresión de la receta (16-nov-2026, pedido del usuario:
 * "un formato de receta médica que permita imprimir dos por hoja", "en
 * horizontal").
 *
 * Una hoja carta en horizontal partida en dos mitades de media carta, que
 * es como se entrega una receta en Venezuela:
 *   · izquierda — RÉCIPE: solo los medicamentos, para la farmacia.
 *   · derecha — INDICACIONES: cómo tomar cada uno, para el paciente.
 * Las dos llevan membrete, paciente, fecha y espacio para firma y sello,
 * porque se cortan por la línea punteada y viajan por separado.
 *
 * Solo existe en papel (`rx-hoja` se oculta en pantalla): la vista en
 * pantalla de la receta no cambia. Se usa CSS propio con medidas en
 * pulgadas en vez de utilidades de Tailwind porque aquí el tamaño físico es
 * el requisito, y `@page` no se puede expresar con clases.
 *
 * `@page` es global mientras esta página está montada — está bien: lo único
 * imprimible de esta pantalla es la receta. Con margen 0 el navegador además
 * deja de imprimir su propio encabezado y pie (fecha, URL), que no pintan
 * nada en una receta.
 */

export interface DatosRecetaImprimible {
  fechaEmision: Date;
  contenido: ContenidoReceta;
  anulada: { fecha: Date; motivo: string | null } | null;
  paciente: {
    nombre: string;
    apellido: string;
    documentoIdentidad: string | null;
    fechaNacimiento: Date | null;
  };
  medico: {
    nombre: string;
    especialidad: string | null;
    numeroColegiado: string | null;
    numeroMpps: string | null;
    cedula: string | null;
    telefono: string | null;
  };
  consultorio: {
    nombre: string;
    direccion: string | null;
    /** Lugar de emisión: va junto a la fecha ("Valera, 28 de octubre…"). */
    municipio: string | null;
  };
}

const ESTILOS = `
.rx-hoja { display: none; }
@media print {
  @page { size: letter landscape; margin: 0; }
  html, body { background: #fff !important; }
  /* Solo la receta llega al papel, sin importar qué avisos o barras tenga
     el resto de la pantalla. */
  body * { visibility: hidden; }
  .rx-hoja, .rx-hoja * { visibility: visible; }
  .rx-hoja {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 11in;
    min-height: 8.45in;
    color: #111;
    font-size: 10.5pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rx-mitad {
    position: relative;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-height: 8.45in;
    padding: 0.45in 0.5in 0.4in;
  }
  .rx-mitad + .rx-mitad { border-left: 1px dashed #9a9a9a; }
  .rx-membrete { border-bottom: 1.5pt solid #111; padding-bottom: 0.1in; }
  .rx-medico { font-size: 14pt; font-weight: 700; line-height: 1.15; }
  .rx-credenciales { margin-top: 2pt; font-size: 9pt; color: #333; }
  .rx-paciente {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2pt 0.25in;
    margin-top: 0.14in;
    font-size: 9.5pt;
  }
  .rx-paciente b { font-weight: 600; }
  .rx-titulo {
    margin-top: 0.2in;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .rx-lista { margin: 0.1in 0 0; padding: 0; list-style: none; }
  .rx-lista li {
    display: grid;
    grid-template-columns: 0.24in 1fr;
    margin-bottom: 0.11in;
    break-inside: avoid;
  }
  .rx-num { font-weight: 600; }
  .rx-nombre { font-weight: 600; }
  .rx-indicacion { color: #222; }
  .rx-generales {
    margin-top: 0.08in;
    padding-top: 0.09in;
    border-top: 0.5pt solid #bbb;
    break-inside: avoid;
  }
  .rx-pie { margin-top: auto; padding-top: 0.3in; break-inside: avoid; }
  .rx-firma {
    width: 2.4in;
    margin-left: auto;
    border-top: 0.75pt solid #111;
    padding-top: 3pt;
    text-align: center;
    font-size: 8.5pt;
  }
  .rx-contacto {
    margin-top: 0.14in;
    border-top: 0.5pt solid #bbb;
    padding-top: 4pt;
    font-size: 8pt;
    color: #444;
    text-align: center;
  }
  .rx-anulada {
    margin-top: 0.12in;
    border: 2pt solid #111;
    padding: 4pt 8pt;
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .rx-anulada span {
    display: block;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
}
`;

function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

/** Edad cumplida el día en que se emitió la receta. */
function edadEn(nacimiento: Date, referencia: Date): number {
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    referencia.getMonth() < nacimiento.getMonth() ||
    (referencia.getMonth() === nacimiento.getMonth() && referencia.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

function Mitad({
  datos,
  titulo,
  conIndicaciones,
}: {
  datos: DatosRecetaImprimible;
  titulo: string;
  conIndicaciones: boolean;
}) {
  const { medico, paciente, consultorio, contenido, anulada } = datos;
  const credenciales = [
    medico.especialidad,
    medico.numeroMpps ? `MPPS ${medico.numeroMpps}` : null,
    medico.numeroColegiado ? `C.M. ${medico.numeroColegiado}` : null,
    medico.cedula ? `C.I. ${medico.cedula}` : null,
  ].filter(Boolean);
  const contacto = [
    // El nombre del consultorio solo aporta si no es el mismo del médico.
    consultorio.nombre !== medico.nombre ? consultorio.nombre : null,
    consultorio.direccion,
    medico.telefono ? `Tel. ${medico.telefono}` : null,
  ].filter(Boolean);

  return (
    <section className="rx-mitad">
      <header className="rx-membrete">
        <p className="rx-medico">{medico.nombre}</p>
        {credenciales.length > 0 && <p className="rx-credenciales">{credenciales.join(" · ")}</p>}
      </header>

      <div className="rx-paciente">
        <span>
          <b>Paciente:</b> {paciente.nombre} {paciente.apellido}
        </span>
        <span>
          {consultorio.municipio ? `${consultorio.municipio}, ` : ""}
          {fechaLarga(datos.fechaEmision)}
        </span>
        <span>
          {paciente.documentoIdentidad && (
            <>
              <b>C.I.:</b> {paciente.documentoIdentidad}
            </>
          )}
        </span>
        <span>
          {paciente.fechaNacimiento && (
            <>
              <b>Edad:</b> {edadEn(paciente.fechaNacimiento, datos.fechaEmision)} años
            </>
          )}
        </span>
      </div>

      {/* Una receta anulada se conserva en la historia; si alguien la
          imprime, cada mitad del papel tiene que decir que no vale. */}
      {anulada && (
        <p className="rx-anulada">
          Anulada — sin validez
          <span>
            {fechaLarga(anulada.fecha)}
            {anulada.motivo ? ` · ${anulada.motivo}` : ""}
          </span>
        </p>
      )}

      <h2 className="rx-titulo">{titulo}</h2>
      <ol className="rx-lista">
        {contenido.medicamentos.map((medicamento, i) => (
          <li key={i}>
            <span className="rx-num">{i + 1}.</span>
            <span>
              <span className="rx-nombre">{medicamento.nombre}</span>
              {conIndicaciones && medicamento.indicaciones && (
                <>
                  <br />
                  <span className="rx-indicacion">{medicamento.indicaciones}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>

      {conIndicaciones && contenido.indicacionesGenerales && (
        <p className="rx-generales">{contenido.indicacionesGenerales}</p>
      )}

      <footer className="rx-pie">
        <p className="rx-firma">Firma y sello</p>
        {contacto.length > 0 && <p className="rx-contacto">{contacto.join(" · ")}</p>}
      </footer>
    </section>
  );
}

export function RecetaImprimible({ datos }: { datos: DatosRecetaImprimible }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ESTILOS }} />
      <div className="rx-hoja">
        <Mitad datos={datos} titulo="Récipe" conIndicaciones={false} />
        <Mitad datos={datos} titulo="Indicaciones" conIndicaciones />
      </div>
    </>
  );
}
