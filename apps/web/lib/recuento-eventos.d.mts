export const FIRMA_VOTO_EMITIDO: string;

export interface EventoVoto {
  opcion: number;
  nullifier: string;
  selector: string | null;
}

export interface SelectoresVia {
  certificado: string;
  zk: string;
}

export interface VotosPorVia {
  certificado: number;
  zk: number;
  otra: number;
}

export interface RecuentoEventos {
  aFavor: number;
  enContra: number;
  abstenciones: number;
  total: number;
  porVia: VotosPorVia | null;
  duplicados: number;
}

export function viaDeSelector(selector: string | null, selectores: SelectoresVia): "certificado" | "zk" | "otra";
export function recontarEventos(eventos: readonly EventoVoto[], selectores: SelectoresVia | null): RecuentoEventos;
export function mismoRecuento(
  a: { aFavor: number; enContra: number; abstenciones: number },
  b: { aFavor: number; enContra: number; abstenciones: number }
): boolean;
export function primerBloqueDesde(
  timestampDe: (numero: number) => Promise<number>,
  bajo: number,
  alto: number,
  objetivo: number
): Promise<number>;
export function rangosDeBloques(desde: number, hasta: number, tamano: number): [number, number][];
export function primerBloqueQueCumple(
  cumple: (numero: number) => Promise<boolean>,
  bajo: number,
  alto: number
): Promise<number>;
export function rangosDelCiclo(
  ultimoProcesado: number,
  objetivo: number,
  tamano: number,
  maximo: number
): [number, number][];
