/**
 * Quiz rules, independent of the UI: correcting an answer, walking through the questions,
 * scoring and pointing at the lessons worth revisiting. Also valid for the module test.
 */

export interface OpcionQuiz {
  texto: string;
  correcta: boolean;
  explicacion: string;
}

export interface PreguntaQuiz {
  id: string;
  /** Present in module test questions: the lesson the question comes from. */
  leccion?: string;
  opciones: OpcionQuiz[];
}

/** Share of right answers needed to pass, whatever the number of questions (3 of 5, 5 of 8). */
export const UMBRAL_APROBADO = 0.6;

export function indiceCorrecta(pregunta: PreguntaQuiz): number {
  const i = pregunta.opciones.findIndex((opcion) => opcion.correcta);
  if (i === -1) throw new Error(`La pregunta ${pregunta.id} no tiene opción correcta`);
  return i;
}

export function corregir(
  pregunta: PreguntaQuiz,
  elegida: number,
): { acierto: boolean; correcta: number } {
  const correcta = indiceCorrecta(pregunta);
  return { acierto: elegida === correcta, correcta };
}

export interface EstadoQuiz {
  /** Index of the question on screen. */
  actual: number;
  /** Option chosen for each question, or null while unanswered. */
  respuestas: (number | null)[];
  terminado: boolean;
}

export function iniciarQuiz(total: number): EstadoQuiz {
  return { actual: 0, respuestas: Array.from({ length: total }, () => null), terminado: false };
}

/** Records the answer to the current question. Answers cannot be changed once given. */
export function responder(
  estado: EstadoQuiz,
  preguntas: readonly PreguntaQuiz[],
  elegida: number,
): EstadoQuiz {
  const pregunta = preguntas[estado.actual];
  if (estado.terminado || !pregunta || estado.respuestas[estado.actual] !== null) return estado;
  if (!Number.isInteger(elegida) || elegida < 0 || elegida >= pregunta.opciones.length) {
    return estado;
  }
  const respuestas = [...estado.respuestas];
  respuestas[estado.actual] = elegida;
  return { ...estado, respuestas };
}

/** Moves to the next question, or finishes after the last one. Needs the current one answered. */
export function avanzar(estado: EstadoQuiz): EstadoQuiz {
  if (estado.terminado || estado.respuestas[estado.actual] === null) return estado;
  if (estado.actual + 1 >= estado.respuestas.length) return { ...estado, terminado: true };
  return { ...estado, actual: estado.actual + 1 };
}

/** Right or wrong for each question; null while unanswered. */
export function resultados(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly (number | null)[],
): (boolean | null)[] {
  return preguntas.map((pregunta, i) => {
    const elegida = respuestas[i];
    return elegida === null || elegida === undefined ? null : corregir(pregunta, elegida).acierto;
  });
}

export interface Nota {
  aciertos: number;
  total: number;
  aprobado: boolean;
}

export function nota(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly (number | null)[],
): Nota {
  const aciertos = resultados(preguntas, respuestas).filter((r) => r === true).length;
  const total = preguntas.length;
  return { aciertos, total, aprobado: total > 0 && aciertos / total >= UMBRAL_APROBADO };
}

/** Lessons of the failed questions, without repeats, in the order they first appear. */
export function leccionesARepasar(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly (number | null)[],
): string[] {
  const falladas = resultados(preguntas, respuestas);
  const lecciones = preguntas
    .filter((pregunta, i) => falladas[i] === false && pregunta.leccion !== undefined)
    .map((pregunta) => pregunta.leccion as string);
  return [...new Set(lecciones)];
}
