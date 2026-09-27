/**
 * A level's module test bank, picked from the `tests` collection loaded once by the page. Pure, so
 * pages avoid one lookup per level and the build does not warn about levels without a bank.
 */
import {
  preguntasPublicables,
  type ConLeccion,
  type LeccionDelTest,
} from '../../features/test/logic/test';

/** A `tests` entry: its ID is `{module folder}/{level}`, as `content.config.ts` generates it. */
export interface EntradaDeTest<T extends ConLeccion> {
  id: string;
  data: { preguntas: readonly T[] };
}

/** Questions of the level's bank whose lesson is published; empty when the level has no bank. */
export function bancoDelNivel<T extends ConLeccion>(
  tests: readonly EntradaDeTest<T>[],
  carpetaModulo: string,
  nivel: string,
  lecciones: readonly LeccionDelTest[],
): T[] {
  const entrada = tests.find((test) => test.id === `${carpetaModulo}/${nivel}`);
  return entrada ? preguntasPublicables(entrada.data.preguntas, lecciones) : [];
}
