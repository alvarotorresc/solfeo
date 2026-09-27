import { describe, expect, it } from 'vitest';
import {
  casoSchema,
  esperadoSchema,
  leccionSchema,
  moduloSchema,
  parSchema,
  quizSchema,
  sqlArchivoSchema,
  temarioSchema,
  testSchema,
} from './schemas';

const opciones = [
  { texto: 'A', correcta: true, explicacion: 'Porque sí es A.' },
  { texto: 'B', explicacion: 'B no encaja.' },
  { texto: 'C', explicacion: 'C tampoco.' },
];

const pregunta = (n: number) => ({ id: `bd-f-04-q${n}`, enunciado: `Pregunta ${n}`, opciones });

const leccion = {
  id: 'bd-f-04',
  modulo: 'bases-de-datos',
  nivel: 'fundamentos',
  orden: 4,
  titulo: 'Consultar con SELECT',
  resumen: 'Resumen.',
  fuentes: [{ titulo: 'SQLite', url: 'https://sqlite.org/lang_select.html' }],
  estado: 'borrador',
};

const rubrica = [1, 2, 3, 4].map((n) => ({
  id: `p${n}`,
  punto: `Punto ${n}`,
  lecciones: ['bd-f-06'],
}));

const caso = {
  id: 'bd-f-caso-01',
  modulo: 'bases-de-datos',
  nivel: 'fundamentos',
  titulo: 'Caso',
  escenario: 'Escenario.',
  pregunta: '¿Cómo lo investigarías?',
  repreguntas: ['¿Y si...?', '¿Qué cambiarías...?'],
  respuesta_modelo: 'Respuesta larga.',
  rubrica,
};

describe('moduloSchema', () => {
  it('accepts a module and rejects unknown keys', () => {
    const modulo = {
      id: 'bases-de-datos',
      prefijo: 'bd',
      orden: 3,
      titulo: 'Bases de datos',
      disponible: true,
    };
    expect(moduloSchema.safeParse(modulo).success).toBe(true);
    expect(moduloSchema.safeParse({ ...modulo, descripcion: 'x' }).success).toBe(false);
  });
});

describe('temarioSchema', () => {
  const tema = {
    id: 'bd-f-04',
    nivel: 'fundamentos',
    orden: 4,
    carpeta: '04-consultar-con-select',
    titulo: 'SELECT',
  };

  /** `n` lessons of fundamentos whose ID number, folder and order all follow 1..n. */
  const nivelCon = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const numero = String(i + 1).padStart(2, '0');
      return {
        id: `bd-f-${numero}`,
        nivel: 'fundamentos',
        orden: i + 1,
        carpeta: `${numero}-leccion`,
        titulo: `Lección ${numero}`,
      };
    });

  const valido = (lecciones: unknown[]) =>
    temarioSchema.safeParse({ modulo: 'bases-de-datos', lecciones }).success;

  it('accepts a coherent entry', () => {
    expect(valido([tema])).toBe(true);
  });

  it.each([3, 10])('accepts a level with %i lessons', (n) => {
    expect(valido(nivelCon(n))).toBe(true);
  });

  it('accepts a lesson inserted between two others without renaming them', () => {
    const [uno, dos, tres] = nivelCon(3).map((t) => ({ ...t, orden: t.orden * 10 }));
    const intercalada = {
      id: 'bd-f-04',
      nivel: 'fundamentos',
      orden: 15,
      carpeta: '04-intercalada',
      titulo: 'Intercalada',
    };
    expect(valido([uno, dos, tres, intercalada])).toBe(true);
  });

  it('accepts an order past 8 and an ID number past 9', () => {
    expect(valido([{ ...tema, id: 'bd-f-12', orden: 12, carpeta: '12-consultar' }])).toBe(true);
  });

  it.each([
    ['level letter', { ...tema, nivel: 'avanzado' }],
    ['folder prefix', { ...tema, carpeta: '03-consultar-con-select' }],
    ['folder named after the order', { ...tema, orden: 2, carpeta: '02-consultar-con-select' }],
    ['order of zero', { ...tema, orden: 0 }],
    ['fractional order', { ...tema, orden: 1.5 }],
    ['one-digit ID number', { ...tema, id: 'bd-f-4', carpeta: '4-consultar' }],
  ])('rejects a mismatched %s', (_, malo) => {
    expect(valido([malo])).toBe(false);
  });

  it('rejects repeated IDs', () => {
    expect(valido([tema, tema])).toBe(false);
    expect(valido([tema, { ...tema, orden: 9, carpeta: '04-otra' }])).toBe(false);
  });

  it('rejects a repeated folder in the same level', () => {
    const [uno, dos] = nivelCon(2);
    expect(valido([uno, { ...dos, id: 'bd-f-01' }])).toBe(false);
  });

  it('rejects a repeated order in the same level but not across levels', () => {
    const [uno, dos] = nivelCon(2);
    expect(valido([uno, { ...dos, orden: 1 }])).toBe(false);
    const intermedio = {
      id: 'bd-i-01',
      nivel: 'intermedio',
      orden: 1,
      carpeta: '01-i',
      titulo: 'I',
    };
    expect(valido([uno, intermedio])).toBe(true);
  });
});

describe('leccionSchema', () => {
  it('accepts a valid frontmatter', () => {
    expect(leccionSchema.safeParse(leccion).success).toBe(true);
  });

  it('accepts an order that differs from the ID number', () => {
    expect(leccionSchema.safeParse({ ...leccion, orden: 11 }).success).toBe(true);
  });

  it.each([
    ['no sources', { ...leccion, fuentes: [] }],
    ['an http source', { ...leccion, fuentes: [{ titulo: 'x', url: 'http://sqlite.org' }] }],
    ['a malformed source', { ...leccion, fuentes: [{ titulo: 'x', url: 'https://' }] }],
    ['an unknown state', { ...leccion, estado: 'publicado' }],
    ['a misspelled key', { ...leccion, resúmen: 'x' }],
    ['an order of zero', { ...leccion, orden: 0 }],
    ['a level that does not match the ID', { ...leccion, nivel: 'intermedio' }],
  ])('rejects %s', (_, mala) => {
    expect(leccionSchema.safeParse(mala).success).toBe(false);
  });
});

describe('esperadoSchema', () => {
  it('accepts rows or a row count, and defaults muta to false', () => {
    const conFilas = esperadoSchema.parse({
      columnas: ['a'],
      filas: [[1], [null]],
      orden_importa: true,
    });
    expect(conFilas.muta).toBe(false);
    expect(
      esperadoSchema.safeParse({ columnas: ['a'], num_filas: 3, orden_importa: false }).success,
    ).toBe(true);
  });

  it.each([
    ['both rows and count', { columnas: ['a'], filas: [[1]], num_filas: 1, orden_importa: true }],
    ['neither rows nor count', { columnas: ['a'], orden_importa: true }],
    ['a row of the wrong width', { columnas: ['a', 'b'], filas: [[1]], orden_importa: true }],
    [
      'an unquoted date',
      { columnas: ['a'], filas: [[new Date('2024-01-01')]], orden_importa: true },
    ],
    ['no orden_importa', { columnas: ['a'], filas: [[1]] }],
  ])('rejects %s', (_, malo) => {
    expect(esperadoSchema.safeParse(malo).success).toBe(false);
  });
});

describe('sqlArchivoSchema', () => {
  it('only accepts keys like q1', () => {
    const esperado = { columnas: ['a'], num_filas: 1, orden_importa: true };
    expect(sqlArchivoSchema.safeParse({ q1: esperado, q12: esperado }).success).toBe(true);
    expect(sqlArchivoSchema.safeParse({ consulta: esperado }).success).toBe(false);
  });
});

describe('quizSchema', () => {
  const quiz = { leccion: 'bd-f-04', preguntas: [1, 2, 3].map(pregunta) };
  const conPreguntas = (n: number) => ({
    ...quiz,
    preguntas: Array.from({ length: n }, (_, i) => pregunta(i + 1)),
  });

  it('accepts three questions with one right answer each', () => {
    const parsed = quizSchema.parse(quiz);
    expect(parsed.preguntas[0]?.opciones[1]?.correcta).toBe(false);
  });

  it.each([7, 12])('accepts %i questions', (n) => {
    expect(quizSchema.safeParse(conPreguntas(n)).success).toBe(true);
  });

  it('rejects a quiz with fewer than three questions', () => {
    expect(quizSchema.safeParse(conPreguntas(2)).success).toBe(false);
  });

  it('rejects repeated question IDs', () => {
    const preguntas = [pregunta(1), pregunta(2), pregunta(1)];
    expect(quizSchema.safeParse({ ...quiz, preguntas }).success).toBe(false);
  });

  it('rejects questions from another lesson', () => {
    expect(quizSchema.safeParse({ ...quiz, leccion: 'bd-f-05' }).success).toBe(false);
  });

  it.each([
    ['two right answers', opciones.map((o) => ({ ...o, correcta: true }))],
    ['no right answer', opciones.map((o) => ({ ...o, correcta: false }))],
    ['an empty explanation', opciones.map((o) => ({ ...o, explicacion: ' ' }))],
    ['two options', opciones.slice(0, 2)],
    ['five options', [...opciones, ...opciones.slice(1)]],
  ])('rejects a question with %s', (_, malas) => {
    const preguntas = [{ ...pregunta(1), opciones: malas }, ...quiz.preguntas.slice(1)];
    expect(quizSchema.safeParse({ ...quiz, preguntas }).success).toBe(false);
  });

  it('requires sql and esperado together', () => {
    const conSql = { ...pregunta(1), sql: 'SELECT 1' };
    expect(
      quizSchema.safeParse({ ...quiz, preguntas: [conSql, ...quiz.preguntas.slice(1)] }).success,
    ).toBe(false);
    const completa = {
      ...conSql,
      esperado: { columnas: ['1'], filas: [[1]], orden_importa: true },
    };
    expect(
      quizSchema.safeParse({ ...quiz, preguntas: [completa, ...quiz.preguntas.slice(1)] }).success,
    ).toBe(true);
  });
});

describe('testSchema', () => {
  const preguntaTest = (n: number) => ({
    id: `bd-f-t${String(n).padStart(2, '0')}`,
    leccion: 'bd-f-01',
    enunciado: `Pregunta ${n}`,
    opciones,
  });
  const banco = (n: number) => Array.from({ length: n }, (_, i) => preguntaTest(i + 1));

  it.each([1, 20, 120])('accepts a bank of %i questions that name their lesson', (n) => {
    expect(testSchema.safeParse({ preguntas: banco(n) }).success).toBe(true);
  });

  it('rejects an empty bank', () => {
    expect(testSchema.safeParse({ preguntas: [] }).success).toBe(false);
  });

  it('rejects repeated question IDs', () => {
    expect(testSchema.safeParse({ preguntas: [preguntaTest(1), preguntaTest(1)] }).success).toBe(
      false,
    );
  });

  it('rejects a question without lesson', () => {
    const preguntas = banco(3);
    const sinLeccion: Record<string, unknown> = { ...preguntas[0] };
    delete sinLeccion['leccion'];
    expect(testSchema.safeParse({ preguntas: [sinLeccion, ...preguntas.slice(1)] }).success).toBe(
      false,
    );
  });
});

describe('casoSchema', () => {
  it('accepts a complete case', () => {
    expect(casoSchema.safeParse(caso).success).toBe(true);
  });

  it.each([
    ['one follow-up question', { ...caso, repreguntas: ['¿Y si...?'] }],
    ['four follow-up questions', { ...caso, repreguntas: ['a', 'b', 'c', 'd'] }],
    ['three rubric points', { ...caso, rubrica: rubrica.slice(0, 3) }],
    [
      'a rubric point without lessons',
      { ...caso, rubrica: [{ ...rubrica[0], lecciones: [] }, ...rubrica.slice(1)] },
    ],
    ['an ID from another level', { ...caso, id: 'bd-i-caso-01' }],
    ['sql without esperado', { ...caso, sql: 'SELECT 1' }],
  ])('rejects %s', (_, malo) => {
    expect(casoSchema.safeParse(malo).success).toBe(false);
  });
});

describe('parSchema', () => {
  const par = {
    id: 'bd-f-par-01',
    concepto: 'SELECT',
    definicion: 'Lee filas.',
    leccion: 'bd-f-04',
    nivel: 'fundamentos',
  };

  it('accepts a pair', () => {
    expect(parSchema.safeParse(par).success).toBe(true);
  });

  it('rejects a pair whose lesson is from another level', () => {
    expect(parSchema.safeParse({ ...par, leccion: 'bd-i-04' }).success).toBe(false);
  });
});
