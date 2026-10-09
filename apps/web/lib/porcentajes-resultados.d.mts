export type OpcionResultado = "a_favor" | "en_contra" | "abstencion";

export const OPCIONES_RESULTADO: readonly {
  clave: "aFavor" | "enContra" | "abstenciones";
  opcion: OpcionResultado;
  etiqueta: string;
}[];

export interface FilaReparto {
  opcion: OpcionResultado;
  etiqueta: string;
  votos: number;
  /** Décimas de porcentaje (333 = 33,3 %); null si no hay votos. */
  decimas: number | null;
  porcentaje: string | null;
}

export interface Reparto {
  total: number;
  filas: FilaReparto[];
  sumaDecimas: number | null;
  sumaTexto: string | null;
  notaRedondeo: string | null;
}

export function decimasDePorcentaje(votos: number, total: number): number;
export function formatearPorcentaje(decimas: number): string;
export function calcularReparto(resultados: { aFavor: number; enContra: number; abstenciones: number }): Reparto;
