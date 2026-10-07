export const TEXTO_SECRETO: string;

export interface DatosJustificante {
  titulo: string;
  propuesta: string;
  periodo: string;
  secreto: string;
  garantia: string;
  nadie: string;
  aviso: string;
}

export function datosJustificante(
  propuesta: { titulo: string; fechaApertura: string; fechaCierre: string },
  zonaHoraria?: string
): DatosJustificante;
export function cadenaPdf(texto: string): string;
export function partirLineas(texto: string, maximo: number): string[];
export function generarPdfJustificante(datos: DatosJustificante): Uint8Array<ArrayBuffer>;
