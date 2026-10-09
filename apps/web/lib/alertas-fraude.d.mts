export type MotivoIntento = "voto-repetido" | "via-no-permitida";
export const MOTIVOS: readonly MotivoIntento[];
export function seudonimoIntento(secretoNullifier: string, propuestaId: string, via: string, nullifier: string | null): string;
export function configuracionAlertas(env: Record<string, string | undefined>): {
  umbral: number;
  ventanaHoras: number;
  webhook: string | null;
  token: string | null;
};
export function superaUmbral(intentos: number, umbral: number): boolean;
export function cuerpoAlerta(datos: {
  propuestaId: string;
  via: string;
  motivo: MotivoIntento;
  intentos: number;
  ventanaHoras: number;
  seudonimo: string;
}): {
  tipo: "civora-alerta-fraude";
  motivo: MotivoIntento;
  propuestaId: string;
  via: string;
  intentos: number;
  ventanaHoras: number;
  seudonimo: string;
};
