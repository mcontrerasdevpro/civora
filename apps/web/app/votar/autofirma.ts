/**
 * Puente con Autofirma (public/js/autoscript.js). La firma se pide en la
 * confirmación del voto, porque el reto firmado incluye la opción (R-04).
 */

declare global {
  interface Window {
    AutoScript?: {
      cargarAppAfirma: (clientAddress?: string, keystore?: string) => void;
      sign: (
        dataB64: string,
        algoritmo: string,
        formato: string,
        parametrosExtra: string,
        onExito: (firmaB64: string, certB64: string) => void,
        onError: (tipoError: string, mensaje: string) => void
      ) => void;
    };
  }
}

export class ErrorAutofirma extends Error {}

export function autofirmaDisponible(): boolean {
  return typeof window !== "undefined" && Boolean(window.AutoScript);
}

function hexABase64(hex: string): string {
  const bytes = hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [];
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

/** Firma el reto (hexadecimal) en CAdES detached con el certificado del usuario. */
export function firmarReto(retoHex: string): Promise<{ firmaB64: string; certB64: string }> {
  return new Promise((resolver, rechazar) => {
    if (!window.AutoScript) {
      rechazar(new ErrorAutofirma("Autofirma no está disponible."));
      return;
    }
    window.AutoScript.sign(
      hexABase64(retoHex),
      "SHA256withRSA",
      "CAdES",
      "mode=explicit\nformat=CAdES",
      (firmaB64, certB64) => resolver({ firmaB64, certB64 }),
      (_tipoError, mensaje) => rechazar(new ErrorAutofirma(mensaje || "No se ha podido firmar con Autofirma."))
    );
  });
}
