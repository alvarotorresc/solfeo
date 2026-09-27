/**
 * Module test rules that the quiz does not already cover: which bank questions can be asked, the
 * draw and the lessons to revisit with their links. Correcting, walking through and scoring reuse
 * `quiz/logic/quiz.ts`.
 */

/** Questions drawn per attempt. With a shorter bank, the test asks all of it. */
export const PREGUNTAS_POR_TEST = 10;

/** Returns a number in [0, 1), like `Math.random`. Injected so the draw can be tested. */
export type Aleatorio = () => number;

/** Anything drawn from the bank: it only needs to know its lesson. */
export interface ConLeccion {
  leccion: string;
}

/** A lesson of the level as the path knows it. `href` is null while it has no content. */
export interface LeccionDelTest {
  id: string;
  titulo: string;
  href: string | null;
}

/** Route of a level's module test, next to its lessons: `/{modulo}/{nivel}/test`. */
export function rutaDelTest(modulo: string, nivel: string): string {
  return `/${modulo}/${nivel}/test`;
}

function indiceAleatorio(aleatorio: Aleatorio, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.floor(aleatorio() * n)));
}

/** Fisher-Yates shuffle into a new list. */
export function barajar<T>(lista: readonly T[], aleatorio: Aleatorio = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = indiceAleatorio(aleatorio, i + 1);
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

/** Bank questions whose lesson is published in this level; the rest cannot point anywhere. */
export function preguntasPublicables<T extends ConLeccion>(
  banco: readonly T[],
  lecciones: readonly LeccionDelTest[],
): T[] {
  const publicadas = new Set(lecciones.filter((l) => l.href !== null).map((l) => l.id));
  return banco.filter((pregunta) => publicadas.has(pregunta.leccion));
}

/**
 * Draws up to `n` questions without repeats, spread as evenly as possible across lessons: one from
 * each lesson in turn until there are enough, so a lesson with a big bank does not crowd out the
 * rest. The result is shuffled so the order does not reveal the rotation.
 */
export function sortear<T extends ConLeccion>(
  banco: readonly T[],
  n: number = PREGUNTAS_POR_TEST,
  aleatorio: Aleatorio = Math.random,
): T[] {
  const cantidad = Math.max(0, Math.min(Math.floor(n), banco.length));
  const porLeccion = new Map<string, T[]>();
  for (const pregunta of banco) {
    const grupo = porLeccion.get(pregunta.leccion);
    if (grupo) grupo.push(pregunta);
    else porLeccion.set(pregunta.leccion, [pregunta]);
  }
  const grupos = barajar(
    [...porLeccion.values()].map((grupo) => barajar(grupo, aleatorio)),
    aleatorio,
  );
  const elegidas: T[] = [];
  for (let vuelta = 0; elegidas.length < cantidad; vuelta++) {
    for (const grupo of grupos) {
      const pregunta = grupo[vuelta];
      if (pregunta && elegidas.length < cantidad) elegidas.push(pregunta);
    }
  }
  return barajar(elegidas, aleatorio);
}

/** How many different lessons a list of questions touches. */
export function contarLecciones(preguntas: readonly ConLeccion[]): number {
  return new Set(preguntas.map((pregunta) => pregunta.leccion)).size;
}

/** A count with its noun: `1 pregunta`, `3 preguntas`. */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** The pass mark as a sentence, with the verb agreeing: `hace falta 1 acierto`. */
export function paraAprobar(minimo: number): string {
  return `Para aprobar ${minimo === 1 ? 'hace' : 'hacen'} falta ${contar(minimo, 'acierto', 'aciertos')}.`;
}

/**
 * How the start card explains the draw, true for every bank size: `total` questions in the bank,
 * from `lecciones` lessons, and `n` asked per attempt.
 */
export function explicarSorteo(
  total: number,
  lecciones: number,
  n: number = PREGUNTAS_POR_TEST,
): string {
  if (total <= n) {
    return lecciones === 1
      ? 'Son todas las preguntas que hay, de una sola lección.'
      : `Son todas las preguntas que hay, de ${lecciones} lecciones.`;
  }
  if (lecciones === 1) {
    return `Salen al azar ${n} de las ${total} preguntas, todas de la misma lección.`;
  }
  if (lecciones > n) {
    return `Salen al azar ${n} de las ${lecciones} lecciones con preguntas, una pregunta de cada una.`;
  }
  return `Salen al azar ${n} de las ${total} preguntas, repartidas entre ${lecciones} lecciones.`;
}

/** Turns the IDs of the lessons to revisit into titles and links, keeping their order. */
export function leccionesConEnlace(
  ids: readonly string[],
  lecciones: readonly LeccionDelTest[],
): LeccionDelTest[] {
  return ids.map((id) => lecciones.find((l) => l.id === id) ?? { id, titulo: id, href: null });
}
