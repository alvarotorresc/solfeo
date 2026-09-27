import { describe, expect, it } from 'vitest';
import {
  UMBRAL_APROBADO,
  indiceCorrecta,
  leccionesARepasar,
  nota,
  type PreguntaQuiz,
} from '../../quiz/logic/quiz';
import {
  PREGUNTAS_POR_TEST,
  barajar,
  contar,
  contarLecciones,
  explicarSorteo,
  paraAprobar,
  leccionesConEnlace,
  preguntasPublicables,
  rutaDelTest,
  sortear,
  type LeccionDelTest,
} from './test';

/** Small seeded generator (mulberry32), so every draw in these tests is reproducible. */
function semilla(valor: number): () => number {
  let s = valor >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PreguntaDeBanco = PreguntaQuiz & { leccion: string };

function pregunta(id: string, leccion: string, correcta = 0): PreguntaDeBanco {
  return {
    id,
    leccion,
    opciones: [0, 1, 2].map((i) => ({
      texto: `Opción ${i}`,
      correcta: i === correcta,
      explicacion: `Por qué ${i}`,
    })),
  };
}

/** `cuantas` questions per lesson, named `bd-f-01-t1`, `bd-f-01-t2`... */
function banco(cuantas: Record<string, number>): PreguntaDeBanco[] {
  return Object.entries(cuantas).flatMap(([leccion, n]) =>
    Array.from({ length: n }, (_, i) => pregunta(`${leccion}-t${i + 1}`, leccion)),
  );
}

function reparto(preguntas: readonly { leccion: string }[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const p of preguntas) cuenta[p.leccion] = (cuenta[p.leccion] ?? 0) + 1;
  return cuenta;
}

const ids = (preguntas: readonly { id: string }[]) => preguntas.map((p) => p.id);

describe('rutaDelTest', () => {
  it('sits next to the lessons of the level', () => {
    expect(rutaDelTest('bases-de-datos', 'intermedio')).toBe('/bases-de-datos/intermedio/test');
  });
});

describe('barajar', () => {
  it('returns a permutation and leaves the input alone', () => {
    const lista = [1, 2, 3, 4, 5, 6];
    const barajada = barajar(lista, semilla(1));
    expect([...barajada].sort()).toEqual(lista);
    expect(lista).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is reproducible with the same generator seed', () => {
    const lista = ['a', 'b', 'c', 'd', 'e'];
    expect(barajar(lista, semilla(7))).toEqual(barajar(lista, semilla(7)));
  });

  it('stays in bounds with generators at the edges of [0, 1)', () => {
    expect(barajar([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(barajar([1, 2, 3], () => 0.999999999)).toEqual([1, 2, 3]);
    expect(barajar([1, 2, 3], () => 1)).toEqual([1, 2, 3]);
  });

  it('handles empty and single-item lists', () => {
    expect(barajar([], semilla(1))).toEqual([]);
    expect(barajar(['x'], semilla(1))).toEqual(['x']);
  });

  it('uses Math.random by default', () => {
    expect(barajar([1, 2, 3]).sort()).toEqual([1, 2, 3]);
  });
});

describe('sortear', () => {
  it('draws the default amount without repeats', () => {
    const todas = banco({ 'bd-f-01': 8, 'bd-f-02': 8 });
    const elegidas = sortear(todas, undefined, semilla(3));
    expect(elegidas).toHaveLength(PREGUNTAS_POR_TEST);
    expect(new Set(ids(elegidas)).size).toBe(PREGUNTAS_POR_TEST);
    for (const p of elegidas) expect(todas).toContain(p);
  });

  it('asks the whole bank when it is shorter than the test', () => {
    const todas = banco({ 'bd-f-01': 2, 'bd-f-02': 1 });
    expect(ids(sortear(todas, 10, semilla(1))).sort()).toEqual(ids(todas).sort());
  });

  it('spreads the draw evenly across lessons', () => {
    const todas = banco({ 'bd-f-01': 5, 'bd-f-02': 5, 'bd-f-03': 5 });
    for (let s = 1; s <= 30; s++) {
      expect(reparto(sortear(todas, 6, semilla(s)))).toEqual({
        'bd-f-01': 2,
        'bd-f-02': 2,
        'bd-f-03': 2,
      });
    }
  });

  it('never lets two lessons differ by more than one question when both have enough', () => {
    const todas = banco({ 'bd-f-01': 6, 'bd-f-02': 6, 'bd-f-04': 6, 'bd-f-05': 6 });
    for (let s = 1; s <= 30; s++) {
      const cuenta = Object.values(reparto(sortear(todas, 10, semilla(s))));
      expect(cuenta).toHaveLength(4);
      expect(Math.max(...cuenta) - Math.min(...cuenta)).toBeLessThanOrEqual(1);
    }
  });

  it('fills up from the bigger lessons when one runs short', () => {
    const todas = banco({ 'bd-f-01': 1, 'bd-f-02': 5, 'bd-f-03': 5 });
    expect(reparto(sortear(todas, 7, semilla(9)))).toEqual({
      'bd-f-01': 1,
      'bd-f-02': 3,
      'bd-f-03': 3,
    });
  });

  it('is reproducible with the same seed and varies between seeds', () => {
    const todas = banco({ 'bd-f-01': 6, 'bd-f-02': 6, 'bd-f-03': 6 });
    expect(sortear(todas, 6, semilla(5))).toEqual(sortear(todas, 6, semilla(5)));
    const distintas = new Set(
      Array.from({ length: 10 }, (_, s) => ids(sortear(todas, 6, semilla(s + 1))).join()),
    );
    expect(distintas.size).toBeGreaterThan(1);
  });

  it('works with a generator that always returns 0', () => {
    const todas = banco({ 'bd-f-01': 3, 'bd-f-02': 3 });
    const elegidas = sortear(todas, 4, () => 0);
    expect(new Set(ids(elegidas)).size).toBe(4);
    expect(reparto(elegidas)).toEqual({ 'bd-f-01': 2, 'bd-f-02': 2 });
  });

  it('gives nothing for an empty bank or a non-positive amount', () => {
    expect(sortear([], 10, semilla(1))).toEqual([]);
    expect(sortear(banco({ 'bd-f-01': 3 }), 0, semilla(1))).toEqual([]);
    expect(sortear(banco({ 'bd-f-01': 3 }), -2, semilla(1))).toEqual([]);
  });

  it('rounds a fractional amount down', () => {
    expect(sortear(banco({ 'bd-f-01': 5 }), 2.7, semilla(1))).toHaveLength(2);
  });

  it('does not change the bank', () => {
    const todas = banco({ 'bd-f-01': 3, 'bd-f-02': 3 });
    const antes = ids(todas);
    sortear(todas, 4, semilla(2));
    expect(ids(todas)).toEqual(antes);
  });

  it('uses Math.random by default', () => {
    expect(sortear(banco({ 'bd-f-01': 4 }), 2)).toHaveLength(2);
  });
});

const leccionesDelNivel: LeccionDelTest[] = [
  { id: 'bd-f-01', titulo: 'Qué es una base de datos', href: '/bd/fundamentos/01-que-es' },
  { id: 'bd-f-02', titulo: 'Tablas', href: null },
  { id: 'bd-f-04', titulo: 'SELECT', href: '/bd/fundamentos/04-select' },
];

describe('preguntasPublicables', () => {
  it('keeps only questions of lessons published in the level', () => {
    const todas = [
      pregunta('a', 'bd-f-01'),
      pregunta('b', 'bd-f-02'),
      pregunta('c', 'bd-f-04'),
      pregunta('d', 'bd-i-01'),
    ];
    expect(ids(preguntasPublicables(todas, leccionesDelNivel))).toEqual(['a', 'c']);
  });

  it('gives nothing when no lesson is published', () => {
    expect(preguntasPublicables([pregunta('a', 'bd-f-01')], [])).toEqual([]);
  });
});

describe('contarLecciones', () => {
  it('counts distinct lessons', () => {
    expect(contarLecciones(banco({ 'bd-f-01': 3, 'bd-f-04': 1 }))).toBe(2);
    expect(contarLecciones([])).toBe(0);
  });
});

describe('contar', () => {
  it('uses the singular only for one', () => {
    expect(contar(1, 'acierto', 'aciertos')).toBe('1 acierto');
    expect(contar(0, 'acierto', 'aciertos')).toBe('0 aciertos');
    expect(contar(6, 'acierto', 'aciertos')).toBe('6 aciertos');
  });
});

describe('paraAprobar', () => {
  it('makes the verb agree with the count', () => {
    expect(paraAprobar(1)).toBe('Para aprobar hace falta 1 acierto.');
    expect(paraAprobar(6)).toBe('Para aprobar hacen falta 6 aciertos.');
  });
});

describe('explicarSorteo', () => {
  it('says every question comes when the bank fits in one test', () => {
    expect(explicarSorteo(4, 1, 10)).toBe('Son todas las preguntas que hay, de una sola lección.');
    expect(explicarSorteo(10, 3, 10)).toBe('Son todas las preguntas que hay, de 3 lecciones.');
  });

  it('describes a draw from a single lesson', () => {
    expect(explicarSorteo(15, 1, 10)).toBe(
      'Salen al azar 10 de las 15 preguntas, todas de la misma lección.',
    );
  });

  it('describes a draw spread across lessons', () => {
    expect(explicarSorteo(20, 4, 10)).toBe(
      'Salen al azar 10 de las 20 preguntas, repartidas entre 4 lecciones.',
    );
  });

  it('says one question per lesson when there are more lessons than questions asked', () => {
    expect(explicarSorteo(14, 12, 10)).toBe(
      'Salen al azar 10 de las 12 lecciones con preguntas, una pregunta de cada una.',
    );
  });

  it('uses the default test size', () => {
    expect(explicarSorteo(PREGUNTAS_POR_TEST + 1, 2)).toContain(`${PREGUNTAS_POR_TEST} de las`);
  });
});

describe('leccionesConEnlace', () => {
  it('adds titles and links in the given order', () => {
    expect(leccionesConEnlace(['bd-f-04', 'bd-f-01'], leccionesDelNivel)).toEqual([
      leccionesDelNivel[2],
      leccionesDelNivel[0],
    ]);
  });

  it('falls back to the bare ID without a link for an unknown lesson', () => {
    expect(leccionesConEnlace(['bd-f-09'], leccionesDelNivel)).toEqual([
      { id: 'bd-f-09', titulo: 'bd-f-09', href: null },
    ]);
  });
});

describe('a whole test with the quiz rules', () => {
  it('scores the draw and points at the lessons of the failed questions', () => {
    const todas = banco({ 'bd-f-01': 4, 'bd-f-04': 4 });
    const elegidas = sortear(todas, 5, semilla(11));
    // Fail every question of bd-f-04, get the rest right.
    const respuestas = elegidas.map((p) => {
      const buena = indiceCorrecta(p);
      return p.leccion === 'bd-f-04' ? (buena + 1) % p.opciones.length : buena;
    });
    const deBdF04 = elegidas.filter((p) => p.leccion === 'bd-f-04').length;
    const final = nota(elegidas, respuestas);
    expect(final.aciertos).toBe(5 - deBdF04);
    expect(final.aprobado).toBe(final.aciertos / 5 >= UMBRAL_APROBADO);
    expect(leccionesConEnlace(leccionesARepasar(elegidas, respuestas), leccionesDelNivel)).toEqual(
      deBdF04 > 0 ? [leccionesDelNivel[2]] : [],
    );
  });
});
