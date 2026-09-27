import { describe, expect, it } from 'vitest';
import {
  avanzar,
  corregir,
  iniciarQuiz,
  indiceCorrecta,
  leccionesARepasar,
  nota,
  responder,
  resultados,
  type PreguntaQuiz,
} from './quiz';

function pregunta(id: string, correcta: number, leccion?: string): PreguntaQuiz {
  return {
    id,
    ...(leccion ? { leccion } : {}),
    opciones: [0, 1, 2].map((i) => ({
      texto: `Opción ${i}`,
      correcta: i === correcta,
      explicacion: `Por qué ${i}`,
    })),
  };
}

const preguntas = [
  pregunta('q1', 0, 'bd-f-01'),
  pregunta('q2', 1, 'bd-f-02'),
  pregunta('q3', 2, 'bd-f-01'),
  pregunta('q4', 0, 'bd-f-03'),
  pregunta('q5', 1),
];

describe('indiceCorrecta and corregir', () => {
  it('finds the right option', () => {
    expect(indiceCorrecta(preguntas[1] as PreguntaQuiz)).toBe(1);
    expect(corregir(preguntas[1] as PreguntaQuiz, 1)).toEqual({ acierto: true, correcta: 1 });
    expect(corregir(preguntas[1] as PreguntaQuiz, 2)).toEqual({ acierto: false, correcta: 1 });
  });

  it('throws when no option is right', () => {
    const rota: PreguntaQuiz = {
      id: 'x',
      opciones: [{ texto: 'a', correcta: false, explicacion: 'b' }],
    };
    expect(() => indiceCorrecta(rota)).toThrow(/no tiene opción correcta/);
  });
});

describe('quiz flow', () => {
  it('starts on the first question with nothing answered', () => {
    expect(iniciarQuiz(3)).toEqual({ actual: 0, respuestas: [null, null, null], terminado: false });
  });

  it('records one answer per question and does not let it change', () => {
    const uno = responder(iniciarQuiz(5), preguntas, 2);
    expect(uno.respuestas[0]).toBe(2);
    expect(responder(uno, preguntas, 0)).toBe(uno);
  });

  it('ignores options out of range', () => {
    const inicio = iniciarQuiz(5);
    expect(responder(inicio, preguntas, 3)).toBe(inicio);
    expect(responder(inicio, preguntas, -1)).toBe(inicio);
    expect(responder(inicio, preguntas, 1.5)).toBe(inicio);
  });

  it('does not advance before answering', () => {
    const inicio = iniciarQuiz(5);
    expect(avanzar(inicio)).toBe(inicio);
  });

  it('walks to the end and then finishes', () => {
    let estado = iniciarQuiz(preguntas.length);
    for (let i = 0; i < preguntas.length; i++) {
      estado = avanzar(responder(estado, preguntas, 0));
    }
    expect(estado.terminado).toBe(true);
    expect(estado.actual).toBe(4);
    expect(responder(estado, preguntas, 1)).toBe(estado);
    expect(avanzar(estado)).toBe(estado);
  });
});

describe('resultados and nota', () => {
  // Right: q1, q2, q5. Wrong: q3, q4.
  const respuestas = [0, 1, 0, 2, 1];

  it('marks each question right, wrong or unanswered', () => {
    expect(resultados(preguntas, [0, 2, null, null, null])).toEqual([
      true,
      false,
      null,
      null,
      null,
    ]);
  });

  it('passes with 3 of 5', () => {
    expect(nota(preguntas, respuestas)).toEqual({ aciertos: 3, total: 5, aprobado: true });
  });

  it('fails with 2 of 5', () => {
    expect(nota(preguntas, [0, 1, 0, 2, 0])).toEqual({ aciertos: 2, total: 5, aprobado: false });
  });

  it('does not pass an empty quiz', () => {
    expect(nota([], []).aprobado).toBe(false);
  });

  it('lists the lessons of failed questions once, in order', () => {
    expect(leccionesARepasar(preguntas, [1, 1, 0, 2, 0])).toEqual(['bd-f-01', 'bd-f-03']);
    expect(leccionesARepasar(preguntas, respuestas)).toEqual(['bd-f-01', 'bd-f-03']);
    expect(leccionesARepasar(preguntas, [0, 1, 2, 0, 1])).toEqual([]);
  });
});

describe('quizzes of any length', () => {
  const deLargo = (n: number) => Array.from({ length: n }, (_, i) => pregunta(`q${i + 1}`, 0));

  /** Answers the first `aciertos` questions right and the rest wrong, walking the whole quiz. */
  function jugar(total: number, aciertos: number) {
    const lista = deLargo(total);
    let estado = iniciarQuiz(total);
    for (let i = 0; i < total; i++) {
      estado = avanzar(responder(estado, lista, i < aciertos ? 0 : 1));
    }
    return { estado, nota: nota(lista, estado.respuestas) };
  }

  it.each([
    [3, 2, true],
    [3, 1, false],
    [7, 5, true],
    [7, 4, false],
  ])('with %i questions and %i right, passing is %s', (total, aciertos, aprobado) => {
    const { estado, nota: final } = jugar(total, aciertos);
    expect(estado.terminado).toBe(true);
    expect(final).toEqual({ aciertos, total, aprobado });
  });
});
