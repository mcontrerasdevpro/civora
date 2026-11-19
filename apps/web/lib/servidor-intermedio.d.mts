export const VERSION_SINTAXIS: "1_0";
export const MINUTOS_CADUCIDAD: number;
export const BYTES_MAXIMOS: number;
export const MAXIMO_PENDIENTES: number;
export const RESPUESTAS: Readonly<{
  ok: string;
  sinOperacion: string;
  sinParametros: string;
  version: string;
  operacion: string;
  demasiadoGrande: string;
  noExiste: string;
  lleno: string;
  interno: string;
}>;
export type Peticion =
  | { tipo: "check" }
  | { tipo: "put"; id: string; datos: string }
  | { tipo: "get"; id: string }
  | { tipo: "error"; respuesta: string };
export function interpretarPeticion(parametros: URLSearchParams, servicio: "almacen" | "recuperacion"): Peticion;
export function unirParametros(url: string, cuerpo: string): URLSearchParams;
export function caducidad(ahora?: Date): Date;
