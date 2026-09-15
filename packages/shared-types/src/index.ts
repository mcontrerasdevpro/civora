import { z } from "zod";

/**
 * Esquema de una propuesta votable.
 *
 * Inspirado en el modelo "idea/v1" de council-dao, pero ampliado con los
 * requisitos de elegibilidad propios de este proyecto: empadronamiento en
 * España, DNI español y residencia continuada de al menos 5 años.
 */
export const EligibilitySchema = z.object({
  /** Debe estar empadronado en algun municipio de España. */
  requiereEmpadronamiento: z.boolean().default(true),
  /** Debe poseer DNI español (no solo NIE ni pasaporte extranjero). */
  requiereDniEspanol: z.boolean().default(true),
  /** Años mínimos de residencia continuada exigidos. */
  anosResidenciaMinimos: z.number().int().min(0).default(5),
  /** Edad mínima para votar. */
  edadMinima: z.number().int().min(0).default(18),
});
export type Eligibility = z.infer<typeof EligibilitySchema>;

export const OpcionVotoSchema = z.enum(["a_favor", "en_contra", "abstencion"]);
export type OpcionVoto = z.infer<typeof OpcionVotoSchema>;

export const PropuestaSchema = z.object({
  schema: z.literal("propuesta/v1"),
  id: z.string().uuid(),
  titulo: z.string().min(1),
  descripcion: z.string().default(""),
  pregunta: z.string().min(1),
  opciones: z.array(OpcionVotoSchema).min(2),
  duracionDias: z.number().int().positive(),
  elegibilidad: EligibilitySchema,
  /** Hash del contenido (para publicar en IPFS / registro on-chain, integridad verificable). */
  contenidoHash: z.string().optional(),
});
export type Propuesta = z.infer<typeof PropuestaSchema>;

/**
 * Un voto NO lleva identidad del votante. Lleva un nullifier (derivado de la
 * prueba ZK) que impide votar dos veces sin revelar quién votó.
 */
export const VotoSchema = z.object({
  schema: z.literal("voto/v1"),
  propuestaId: z.string().uuid(),
  opcion: OpcionVotoSchema,
  /** Identificador único derivado de la prueba ZK, para evitar doble voto. */
  nullifier: z.string(),
  /** Prueba ZK de elegibilidad (edad, DNI español, empadronamiento, residencia) sin revelar datos personales. */
  pruebaZk: z.string(),
  timestamp: z.number().int(),
});
export type Voto = z.infer<typeof VotoSchema>;

export const ResultadoPropuestaSchema = z.object({
  propuestaId: z.string().uuid(),
  registrados: z.number().int().nonnegative(),
  aFavor: z.number().int().nonnegative(),
  enContra: z.number().int().nonnegative(),
  abstenciones: z.number().int().nonnegative(),
});
export type ResultadoPropuesta = z.infer<typeof ResultadoPropuestaSchema>;
