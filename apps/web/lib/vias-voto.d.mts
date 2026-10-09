export type ViaVoto = "certificado" | "zk";
export const VIAS: readonly ViaVoto[];
export const VIAS_POR_DEFECTO: readonly ViaVoto[];
export function viasHabilitadas(valor: string | undefined): ViaVoto[];
export function viaPermitida(vias: readonly string[], via: string): boolean;
export function permiteVotoCruzado(vias: readonly string[]): boolean;
