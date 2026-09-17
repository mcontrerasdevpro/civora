/**
 * Validacion de formato del DNI español (letra de control) y de la edad
 * minima, para la via de "datos manuales" en /votar.
 *
 * Esto NO es una verificacion oficial: solo comprueba que el DNI introducido
 * tiene un formato valido y que la persona declara la edad suficiente. No
 * contrasta con ningun registro del Estado (ver docs/modelo-amenazas.md).
 */

const TABLA_LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizarDni(valor: string): string {
  return valor.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function dniValido(valor: string): boolean {
  const dni = normalizarDni(valor);
  const coincide = /^(\d{8})([A-Z])$/.exec(dni);
  if (!coincide) return false;
  const [, numero, letra] = coincide;
  return TABLA_LETRAS[Number(numero) % 23] === letra;
}

export function edadCumplida(fechaNacimientoIso: string, edadMinima: number): boolean {
  const nacimiento = new Date(fechaNacimientoIso);
  if (Number.isNaN(nacimiento.getTime())) return false;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumpleEsteAnio =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumpleEsteAnio) {
    edad -= 1;
  }
  return edad >= edadMinima;
}
