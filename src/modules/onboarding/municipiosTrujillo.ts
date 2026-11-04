/**
 * Catálogo cerrado de los 20 municipios del estado Trujillo — ver changelog
 * punto 26 (fuente: citypopulation.de, listado administrativo del estado).
 * HIPÓTESIS a confirmar si el Directorio/OS amplía cobertura fuera de
 * Trujillo (ver changelog punto 26): este selector dejaría de alcanzar.
 */
export const MUNICIPIOS_TRUJILLO = [
  "Andrés Bello",
  "Boconó",
  "Bolívar",
  "Candelaria",
  "Carache",
  "Escuque",
  "José Felipe Márquez Cañizales",
  "Juan Vicente Campo Elías",
  "La Ceiba",
  "Miranda",
  "Monte Carmelo",
  "Motatán",
  "Pampán",
  "Pampanito",
  "Rafael Rangel",
  "San Rafael de Carvajal",
  "Sucre",
  "Trujillo",
  "Urdaneta",
  "Valera",
] as const;

export type MunicipioTrujillo = (typeof MUNICIPIOS_TRUJILLO)[number];

export function esMunicipioTrujillo(valor: string): valor is MunicipioTrujillo {
  return (MUNICIPIOS_TRUJILLO as readonly string[]).includes(valor);
}
