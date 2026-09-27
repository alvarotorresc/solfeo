import { describe, expect, it } from 'vitest';
import { NIVELES } from '../../../lib/niveles';
import {
  CASOS_POR_SESION,
  alternarPunto,
  avanzar,
  barajar,
  casosDelFiltro,
  claveDeFiltro,
  elegirCasos,
  iniciarSesion,
  opcionesDeSesion,
  puntuacionDeCaso,
  resumir,
  rotuloDePaso,
  textoParaAvanzar,
  type CasoDeSesion,
  type EstadoSesion,
} from './sesion';

function caso(
  id: string,
  extra: Partial<CasoDeSesion> = {},
  repreguntas = 2,
  puntos = 4,
): CasoDeSesion {
  return {
    id,
    modulo: 'bases-de-datos',
    nivel: 'fundamentos',
    titulo: `Caso ${id}`,
    escenario: 'Escenario',
    pregunta: 'Pregunta',
    repreguntas: Array.from({ length: repreguntas }, (_, i) => `Repregunta ${i + 1}`),
    rubrica: Array.from({ length: puntos }, (_, i) => ({
      id: `p${i + 1}`,
      punto: `Punto ${i + 1}`,
      lecciones: [`bd-f-0${i + 1}`],
    })),
    ...extra,
  };
}

const f1 = caso('bd-f-caso-01');
const f2 = caso('bd-f-caso-02');
const i1 = caso('bd-i-caso-01', { nivel: 'intermedio' });
const r1 = caso('r-f-caso-01', { modulo: 'redes' });
const todos = [f1, f2, i1, r1];

/** Random source that replays the given values. */
const secuencia = (valores: number[]) => {
  let i = 0;
  return () => valores[i++ % valores.length] ?? 0;
};

/** Walks a session to the rubric of its current case. */
function hastaRubrica(estado: EstadoSesion, casos: CasoDeSesion[]): EstadoSesion {
  let e = estado;
  while (e.paso.tipo !== 'rubrica') e = avanzar(e, casos);
  return e;
}

describe('casosDelFiltro', () => {
  it('keeps the module and level of the filter', () => {
    const filtrados = casosDelFiltro(todos, {
      tipo: 'nivel',
      modulo: 'bases-de-datos',
      nivel: 'fundamentos',
    });
    expect(filtrados.map((c) => c.id)).toEqual(['bd-f-caso-01', 'bd-f-caso-02']);
  });

  it('takes every case in a mixed session', () => {
    expect(casosDelFiltro(todos, { tipo: 'mixta' })).toHaveLength(4);
  });
});

describe('barajar', () => {
  it('keeps the same elements and does not touch the input', () => {
    const entrada = [1, 2, 3, 4, 5];
    const salida = barajar(entrada, secuencia([0.3, 0.8, 0.1, 0.5]));
    expect([...salida].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(entrada).toEqual([1, 2, 3, 4, 5]);
  });

  it('reverses nothing when the random source always gives the top index', () => {
    expect(barajar([1, 2, 3], () => 0.999)).toEqual([1, 2, 3]);
  });

  it('clamps a random source that returns 1 or a negative number', () => {
    expect(barajar([1, 2, 3], () => 1)).toEqual([1, 2, 3]);
    expect(barajar([1, 2, 3], () => -1)).toEqual([2, 3, 1]);
  });

  it('moves elements with a low draw', () => {
    expect(barajar([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });

  it('handles empty and single lists', () => {
    expect(barajar([], Math.random)).toEqual([]);
    expect(barajar(['a'], Math.random)).toEqual(['a']);
  });
});

describe('elegirCasos', () => {
  it('draws every case when there are fewer than a session holds', () => {
    const elegidos = elegirCasos([f1], { tipo: 'mixta' }, () => 0.5);
    expect(elegidos).toEqual([f1]);
  });

  it('draws at most the session size', () => {
    const muchos = Array.from({ length: 6 }, (_, i) => caso(`bd-f-caso-0${i + 1}`));
    expect(elegirCasos(muchos, { tipo: 'mixta' }, () => 0.4)).toHaveLength(CASOS_POR_SESION);
  });

  it('respects an explicit maximum, never below zero', () => {
    expect(elegirCasos(todos, { tipo: 'mixta' }, () => 0.4, 2)).toHaveLength(2);
    expect(elegirCasos(todos, { tipo: 'mixta' }, () => 0.4, -1)).toEqual([]);
  });

  it('only draws cases of the filter, in the order of the random source', () => {
    const elegidos = elegirCasos(
      todos,
      { tipo: 'nivel', modulo: 'bases-de-datos', nivel: 'fundamentos' },
      () => 0,
    );
    expect(elegidos.map((c) => c.id)).toEqual(['bd-f-caso-02', 'bd-f-caso-01']);
  });

  it('uses Math.random by default', () => {
    expect(elegirCasos(todos, { tipo: 'mixta' })).toHaveLength(CASOS_POR_SESION);
  });
});

describe('opcionesDeSesion', () => {
  it('lists each module and level with cases, then the mixed session', () => {
    const opciones = opcionesDeSesion([r1, i1, f2, f1], ['bases-de-datos', 'redes'], NIVELES);
    expect(opciones.map((o) => [o.clave, o.casos])).toEqual([
      ['bases-de-datos/fundamentos', 2],
      ['bases-de-datos/intermedio', 1],
      ['redes/fundamentos', 1],
      ['mixta', 4],
    ]);
  });

  it('leaves out the mixed session when there is nothing to mix', () => {
    const opciones = opcionesDeSesion([f1, f2], ['bases-de-datos'], NIVELES);
    expect(opciones.map((o) => o.clave)).toEqual(['bases-de-datos/fundamentos']);
  });

  it('puts unknown modules last, alphabetically', () => {
    const otro = caso('x-f-caso-01', { modulo: 'zeta' });
    const otro2 = caso('y-f-caso-01', { modulo: 'alfa' });
    const opciones = opcionesDeSesion([otro, f1, otro2], ['bases-de-datos'], NIVELES);
    expect(opciones.map((o) => o.clave)).toEqual([
      'bases-de-datos/fundamentos',
      'alfa/fundamentos',
      'zeta/fundamentos',
      'mixta',
    ]);
  });

  it('gives nothing without cases', () => {
    expect(opcionesDeSesion([], [], NIVELES)).toEqual([]);
  });
});

describe('claveDeFiltro', () => {
  it('names both kinds of filter', () => {
    expect(claveDeFiltro({ tipo: 'mixta' })).toBe('mixta');
    expect(claveDeFiltro({ tipo: 'nivel', modulo: 'redes', nivel: 'avanzado' })).toBe(
      'redes/avanzado',
    );
  });
});

describe('avanzar', () => {
  it('goes question, each follow-up, rubric, then the next case', () => {
    const casos = [caso('a', {}, 2), caso('b', {}, 3)];
    let e = iniciarSesion(casos.length);
    const pasos: string[] = [];
    while (!e.terminada) {
      pasos.push(rotuloDePaso(e, casos));
      e = avanzar(e, casos);
    }
    pasos.push(rotuloDePaso(e, casos));
    expect(pasos).toEqual([
      'Caso 1 de 2, pregunta',
      'Caso 1 de 2, repregunta 1 de 2',
      'Caso 1 de 2, repregunta 2 de 2',
      'Caso 1 de 2, rúbrica',
      'Caso 2 de 2, pregunta',
      'Caso 2 de 2, repregunta 1 de 3',
      'Caso 2 de 2, repregunta 2 de 3',
      'Caso 2 de 2, repregunta 3 de 3',
      'Caso 2 de 2, rúbrica',
      'Resumen',
    ]);
  });

  it('goes straight to the rubric when a case has no follow-ups', () => {
    const casos = [caso('a', {}, 0)];
    expect(avanzar(iniciarSesion(1), casos).paso).toEqual({ tipo: 'rubrica' });
  });

  it('keeps the marks of earlier cases', () => {
    const casos = [f1, f2];
    let e = alternarPunto(hastaRubrica(iniciarSesion(2), casos), casos, 'p2');
    e = avanzar(e, casos);
    expect(e.actual).toBe(1);
    expect(e.marcados).toEqual([['p2'], []]);
  });

  it('does nothing once finished or without cases', () => {
    const vacia = iniciarSesion(0);
    expect(vacia.terminada).toBe(true);
    expect(avanzar(vacia, [])).toBe(vacia);
    const sinCaso: EstadoSesion = { ...iniciarSesion(1), actual: 3 };
    expect(avanzar(sinCaso, [f1])).toBe(sinCaso);
  });
});

describe('alternarPunto', () => {
  it('marks and unmarks a point of the current rubric', () => {
    const casos = [f1];
    const rubrica = hastaRubrica(iniciarSesion(1), casos);
    const marcado = alternarPunto(rubrica, casos, 'p3');
    expect(marcado.marcados[0]).toEqual(['p3']);
    expect(alternarPunto(marcado, casos, 'p3').marcados[0]).toEqual([]);
    expect(rubrica.marcados[0]).toEqual([]);
  });

  it('ignores marks before the rubric is on screen', () => {
    const e = iniciarSesion(1);
    expect(alternarPunto(e, [f1], 'p1')).toBe(e);
  });

  it('ignores unknown points', () => {
    const e = hastaRubrica(iniciarSesion(1), [f1]);
    expect(alternarPunto(e, [f1], 'p99')).toBe(e);
  });

  it('ignores marks once finished or without a case on screen', () => {
    const casos = [f1];
    const fin = avanzar(hastaRubrica(iniciarSesion(1), casos), casos);
    expect(fin.terminada).toBe(true);
    expect(alternarPunto(fin, casos, 'p1')).toBe(fin);
    const sinCaso: EstadoSesion = { ...fin, terminada: false, actual: 5 };
    expect(alternarPunto(sinCaso, casos, 'p1')).toBe(sinCaso);
  });

  it('starts from an empty list when the marks are missing', () => {
    const e: EstadoSesion = { ...hastaRubrica(iniciarSesion(1), [f1]), marcados: [] };
    expect(alternarPunto(e, [f1], 'p1').marcados).toEqual([['p1']]);
  });
});

describe('rotuloDePaso', () => {
  it('falls back to the case count without a case on screen', () => {
    expect(rotuloDePaso({ ...iniciarSesion(1), actual: 2 }, [f1])).toBe('Caso 3 de 1');
  });
});

describe('textoParaAvanzar', () => {
  const dos = caso('a', {}, 2);
  it('names what comes next', () => {
    expect(textoParaAvanzar(dos, { tipo: 'pregunta' }, false)).toBe('Pasar a la repregunta');
    expect(textoParaAvanzar(dos, { tipo: 'repregunta', indice: 0 }, false)).toBe(
      'Siguiente repregunta',
    );
    expect(textoParaAvanzar(dos, { tipo: 'repregunta', indice: 1 }, false)).toBe(
      'Ver la respuesta modelo',
    );
    expect(textoParaAvanzar(dos, { tipo: 'rubrica' }, false)).toBe('Siguiente caso');
    expect(textoParaAvanzar(dos, { tipo: 'rubrica' }, true)).toBe('Ver el resumen');
  });

  it('goes to the model answer from the question when there are no follow-ups', () => {
    expect(textoParaAvanzar(caso('b', {}, 0), { tipo: 'pregunta' }, true)).toBe(
      'Ver la respuesta modelo',
    );
  });
});

describe('puntuacion y resumen', () => {
  it('counts the marked points of the rubric only', () => {
    expect(puntuacionDeCaso(f1, ['p1', 'p4', 'p9'])).toEqual({ tocados: 2, total: 4 });
    expect(puntuacionDeCaso(f1, undefined)).toEqual({ tocados: 0, total: 4 });
  });

  it('sums the session and lists the missed points of each case', () => {
    const a = caso('a');
    const b = caso('b', {
      rubrica: [
        { id: 'p1', punto: 'Uno', lecciones: ['bd-f-06', 'bd-f-02'] },
        { id: 'p2', punto: 'Dos', lecciones: ['bd-f-02'] },
        { id: 'p3', punto: 'Tres', lecciones: ['bd-f-07'] },
        { id: 'p4', punto: 'Cuatro', lecciones: ['bd-f-01'] },
      ],
    });
    const resumen = resumir([a, b], [['p1', 'p2', 'p3', 'p4'], ['p4']]);
    expect(resumen.total).toEqual({ tocados: 5, total: 8 });
    expect(resumen.casos[0]).toMatchObject({
      id: 'a',
      titulo: 'Caso a',
      puntuacion: { tocados: 4, total: 4 },
      flojos: [],
    });
    expect(resumen.casos[1]?.flojos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(resumen.lecciones).toEqual(['bd-f-06', 'bd-f-02', 'bd-f-07']);
  });

  it('treats missing marks as nothing marked', () => {
    const resumen = resumir([f1], []);
    expect(resumen.total).toEqual({ tocados: 0, total: 4 });
    expect(resumen.lecciones).toEqual(['bd-f-01', 'bd-f-02', 'bd-f-03', 'bd-f-04']);
  });

  it('is empty for an empty session', () => {
    expect(resumir([], [])).toEqual({ casos: [], total: { tocados: 0, total: 0 }, lecciones: [] });
  });
});
