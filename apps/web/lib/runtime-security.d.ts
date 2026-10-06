export function isLocalRpcUrl(rpcUrl: string | undefined): boolean;
export function validarFalloAbiertoRevocacion(
  falloAbierto: boolean,
  rpcUrl: string | undefined,
  nodeEnv: string | undefined
): void;
export function validarConfiguracionZkWeb(
  dominio: string | undefined,
  devMode: string | undefined,
  rpcUrl: string | undefined,
  nodeEnv: string | undefined,
  demoTestnet?: string | undefined
): void;