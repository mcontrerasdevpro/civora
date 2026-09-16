import type { Propuesta } from "@civora/shared-types";

/**
 * Unica propuesta activa de esta PoC. Cuando haya mas de una, esto pasa a
 * ser una consulta a packages/contracts en lugar de una constante.
 */
export const PROPUESTA_DEMO: Propuesta = {
  schema: "propuesta/v1",
  id: "b3f1a2c4-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
  titulo: "Presupuestos participativos 2027",
  descripcion:
    "Propuesta de ejemplo para probar el flujo de voto de extremo a extremo.",
  pregunta: "¿Apruebas la propuesta de presupuestos participativos 2027?",
  opciones: ["a_favor", "en_contra", "abstencion"],
  duracionDias: 30,
  elegibilidad: {
    requiereEmpadronamiento: true,
    requiereDniEspanol: true,
    anosResidenciaMinimos: 5,
    edadMinima: 18,
  },
};
