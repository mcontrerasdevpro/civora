import { createHash, timingSafeEqual } from "node:crypto";

const VENTANA_MS = 15 * 60 * 1000;
const LIMITE_SOLICITUDES = 5;
const solicitudesPorClave = new Map();

export function adminSecretMatches(provided, expected) {
  const recibido = createHash("sha256").update(provided ?? "").digest();
  const esperado = createHash("sha256").update(expected ?? "").digest();
  return Boolean(expected) && timingSafeEqual(recibido, esperado);
}

export function checkAdminRateLimit(key, now = Date.now()) {
  const recientes = (solicitudesPorClave.get(key) ?? []).filter((time) => time > now - VENTANA_MS);
  if (recientes.length >= LIMITE_SOLICITUDES) {
    solicitudesPorClave.set(key, recientes);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((recientes[0] + VENTANA_MS - now) / 1000)),
    };
  }

  recientes.push(now);
  solicitudesPorClave.set(key, recientes);
  if (solicitudesPorClave.size > 10000) {
    for (const [candidate, times] of solicitudesPorClave) {
      if (times.every((time) => time <= now - VENTANA_MS)) solicitudesPorClave.delete(candidate);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}