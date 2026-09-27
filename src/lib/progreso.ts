/**
 * Learner progress, kept in the browser under a single versioned key. Pure functions plus two
 * small storage helpers that never throw: private mode, blocked storage or corrupt data all fall
 * back to empty progress.
 */
// zod/mini: same validation as the content schemas, a fraction of the weight in the browser.
import * as z from 'zod/mini';
import { CLAVE_PROGRESO } from './claves';
import { LETRA_NIVEL, NIVELES, PATRON_LECCION_ID, type Nivel } from './niveles';

export { CLAVE_PROGRESO };

const listaDeLecciones = z.array(z.string().check(z.regex(PATRON_LECCION_ID)));

export const progresoSchema = z.object({
  nivel: z.enum(NIVELES),
  hechas: z.object({
    fundamentos: listaDeLecciones,
    intermedio: listaDeLecciones,
    avanzado: listaDeLecciones,
  }),
});
export type Progreso = z.infer<typeof progresoSchema>;

type Lector = Pick<Storage, 'getItem'>;
type Escritor = Pick<Storage, 'setItem'>;

export function progresoVacio(nivel: Nivel = 'fundamentos'): Progreso {
  return { nivel, hechas: { fundamentos: [], intermedio: [], avanzado: [] } };
}

/** Parses stored progress. Anything that is not valid JSON matching the schema gives empty progress. */
export function parsearProgreso(texto: string | null): Progreso {
  if (texto === null) return progresoVacio();
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return progresoVacio();
  }
  const resultado = progresoSchema.safeParse(datos);
  return resultado.success ? resultado.data : progresoVacio();
}

export function leerProgreso(almacen: Lector | undefined): Progreso {
  try {
    return parsearProgreso(almacen?.getItem(CLAVE_PROGRESO) ?? null);
  } catch {
    return progresoVacio();
  }
}

/** Saves progress. Returns false when the browser refuses (quota, private mode, blocked storage). */
export function guardarProgreso(almacen: Escritor | undefined, progreso: Progreso): boolean {
  if (!almacen) return false;
  try {
    almacen.setItem(CLAVE_PROGRESO, JSON.stringify(progreso));
    return true;
  } catch {
    return false;
  }
}

/** Level a lesson ID belongs to, from its letter (`bd-f-04` → fundamentos). */
export function nivelDeLeccion(id: string): Nivel | undefined {
  const letra = id.split('-')[1];
  return NIVELES.find((nivel) => LETRA_NIVEL[nivel] === letra);
}

export function estaHecha(progreso: Progreso, id: string): boolean {
  const nivel = nivelDeLeccion(id);
  return nivel !== undefined && progreso.hechas[nivel].includes(id);
}

/** Marks a lesson as done. Returns the same object when nothing changes. */
export function marcarHecha(progreso: Progreso, id: string): Progreso {
  const nivel = nivelDeLeccion(id);
  if (!nivel || !PATRON_LECCION_ID.test(id) || estaHecha(progreso, id)) return progreso;
  const hechas = [...progreso.hechas[nivel], id].sort();
  return { ...progreso, hechas: { ...progreso.hechas, [nivel]: hechas } };
}

export function cambiarNivel(progreso: Progreso, nivel: Nivel): Progreso {
  return progreso.nivel === nivel ? progreso : { ...progreso, nivel };
}

/** Forgets every finished lesson but keeps the chosen level. */
export function borrarLecciones(progreso: Progreso): Progreso {
  return progresoVacio(progreso.nivel);
}

/** How many of the given lessons are done. */
export function contarHechas(progreso: Progreso, ids: readonly string[]): number {
  return ids.filter((id) => estaHecha(progreso, id)).length;
}

/** How many lessons in a row are done from the start of the list; the path rail fills that far. */
export function hechasSeguidas(progreso: Progreso, ids: readonly string[]): number {
  const primera = ids.findIndex((id) => !estaHecha(progreso, id));
  return primera === -1 ? ids.length : primera;
}

/** First lesson of the list, in order, that is not done yet. */
export function siguientePendiente(progreso: Progreso, ids: readonly string[]): string | undefined {
  return ids.find((id) => !estaHecha(progreso, id));
}
