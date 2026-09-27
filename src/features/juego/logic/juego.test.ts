import { describe, expect, it } from 'vitest';
import {
  MIN_PARES_RONDA,
  TAMANO_RONDA,
  TODOS_LOS_NIVELES,
  anuncio,
  barajar,
  elegirRonda,
  estaEmparejado,
  filtrarPorNivel,
  filtroInicial,
  iniciarRonda,
  paresPublicables,
  plural,
  puntuar,
  recuentoPorNivel,
  rondaTerminada,
  seleccionar,
  sePuedeJugar,
  siguienteConceptoLibre,
  type EstadoRonda,
  type ParDeContenido,
  type ParJuego,
} from './juego';

const par = (n: number, nivel: ParJuego['nivel'] = 'fundamentos'): ParJuego => ({
  id: `bd-${nivel[0]}-par-0${n}`,
  concepto: `Concepto ${n}`,
  definicion: `Definición ${n}`,
  nivel,
});

/** Lowest possible value: Fisher–Yates always swaps with the first slot. */
const siempreCero = () => 0;
/** `Math.random`-like value at the top of the range: Fisher–Yates then keeps the order. */
const casiUno = () => 0.999999;

/** Round whose concepts are shown in the given order (no shuffling). */
function rondaOrdenada(pares: ParJuego[]): EstadoRonda {
  return iniciarRonda(pares, casiUno);
}

describe('paresPublicables', () => {
  const contenido: ParDeContenido[] = [
    { ...par(1), leccion: 'bd-f-03' },
    { ...par(2), leccion: 'bd-f-04' },
    { ...par(3), leccion: 'bd-f-01' },
  ];

  it('keeps only pairs whose lesson is published, without the lesson field', () => {
    const publicadas = new Set(['bd-f-01', 'bd-f-04']);
    expect(paresPublicables(contenido, publicadas)).toEqual([par(2), par(3)]);
  });

  it('drops pairs of lessons that do not exist, like bd-f-03 today', () => {
    expect(paresPublicables(contenido, new Set(['bd-f-01'])).map((p) => p.id)).toEqual([par(3).id]);
  });

  it('gives nothing when no lesson is published', () => {
    expect(paresPublicables(contenido, new Set())).toEqual([]);
  });
});

describe('filtrarPorNivel y recuentoPorNivel', () => {
  const pares = [par(1), par(2, 'intermedio'), par(3), par(4, 'avanzado')];

  it('filters by level', () => {
    expect(filtrarPorNivel(pares, 'fundamentos').map((p) => p.id)).toEqual([par(1).id, par(3).id]);
    expect(filtrarPorNivel(pares, 'avanzado')).toEqual([par(4, 'avanzado')]);
  });

  it('keeps every pair with «all levels», in a new array', () => {
    const todos = filtrarPorNivel(pares, TODOS_LOS_NIVELES);
    expect(todos).toEqual(pares);
    expect(todos).not.toBe(pares);
  });

  it('counts pairs per option', () => {
    expect(recuentoPorNivel(pares)).toEqual({
      fundamentos: 2,
      intermedio: 1,
      avanzado: 1,
      todos: 4,
    });
    expect(recuentoPorNivel([])).toEqual({ fundamentos: 0, intermedio: 0, avanzado: 0, todos: 0 });
  });
});

describe('sePuedeJugar', () => {
  it('needs the minimum number of pairs', () => {
    expect(MIN_PARES_RONDA).toBeGreaterThanOrEqual(2);
    expect(sePuedeJugar(Array.from({ length: MIN_PARES_RONDA }, (_, i) => par(i)))).toBe(true);
    expect(sePuedeJugar(Array.from({ length: MIN_PARES_RONDA - 1 }, (_, i) => par(i)))).toBe(false);
    expect(sePuedeJugar([])).toBe(false);
  });
});

describe('filtroInicial', () => {
  const recuento = (f: number, i: number, a: number) => ({
    fundamentos: f,
    intermedio: i,
    avanzado: a,
    todos: f + i + a,
  });

  it('keeps the preferred option when it has enough pairs', () => {
    expect(filtroInicial('intermedio', recuento(3, 3, 0))).toBe('intermedio');
    expect(filtroInicial('todos', recuento(3, 0, 0))).toBe('todos');
  });

  it('falls back to all levels when the preferred one is short or unknown', () => {
    expect(filtroInicial('avanzado', recuento(3, 1, 1))).toBe('todos');
    expect(filtroInicial(undefined, recuento(0, 2, 2))).toBe('todos');
    expect(filtroInicial('otra-cosa', recuento(3, 0, 0))).toBe('todos');
  });

  it('gives the first playable level if even all levels fall short', () => {
    expect(filtroInicial('fundamentos', { ...recuento(0, 3, 0), todos: 0 })).toBe('intermedio');
  });

  it('gives nothing when no option can be played', () => {
    expect(filtroInicial('fundamentos', recuento(1, 0, 1))).toBeUndefined();
  });
});

describe('barajar', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const entrada = [1, 2, 3, 4, 5];
    let semilla = 7;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return (semilla - 1) / 2147483646;
    };
    const salida = barajar(entrada, azar);
    expect(entrada).toEqual([1, 2, 3, 4, 5]);
    expect([...salida].sort()).toEqual(entrada);
  });

  it('is reproducible with injected randomness', () => {
    expect(barajar([1, 2, 3, 4], siempreCero)).toEqual([2, 3, 4, 1]);
    expect(barajar([1, 2, 3, 4], siempreCero)).toEqual(barajar([1, 2, 3, 4], siempreCero));
    expect(barajar([1, 2, 3, 4], casiUno)).toEqual([1, 2, 3, 4]);
  });

  it('never goes out of range even if the source returns 1', () => {
    expect([...barajar(['a', 'b', 'c'], () => 1)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('handles empty and single lists', () => {
    expect(barajar([])).toEqual([]);
    expect(barajar(['solo'])).toEqual(['solo']);
  });
});

describe('elegirRonda', () => {
  const muchos = Array.from({ length: 9 }, (_, i) => par(i + 1));

  it('draws TAMANO_RONDA different pairs when there are more', () => {
    const ronda = elegirRonda(muchos, siempreCero);
    expect(ronda).toHaveLength(TAMANO_RONDA);
    expect(new Set(ronda.map((p) => p.id)).size).toBe(TAMANO_RONDA);
    ronda.forEach((p) => expect(muchos).toContainEqual(p));
  });

  it('uses every pair when there are fewer than the round size', () => {
    const pocos = muchos.slice(0, 3);
    expect(elegirRonda(pocos, siempreCero)).toHaveLength(3);
  });

  it('accepts another size and never a negative one', () => {
    expect(elegirRonda(muchos, casiUno, 2)).toEqual([par(1), par(2)]);
    expect(elegirRonda(muchos, casiUno, -1)).toEqual([]);
  });
});

describe('ronda', () => {
  const tres = [par(1), par(2), par(3)];

  it('starts with shuffled columns and nothing matched', () => {
    const estado = iniciarRonda(tres, siempreCero);
    expect([...estado.conceptos].sort()).toEqual(tres.map((p) => p.id).sort());
    expect([...estado.definiciones].sort()).toEqual(tres.map((p) => p.id).sort());
    expect(estado.emparejados).toEqual([]);
    expect(estado.fallos).toBe(0);
    expect(estado.seleccion).toEqual({ concepto: null, definicion: null });
    expect(estado.ultimo).toBeNull();
    expect(rondaTerminada(estado)).toBe(false);
  });

  it('never shows the definitions in the same order as the concepts', () => {
    // casiUno keeps both shuffles in the original order, so the columns would line up.
    const estado = iniciarRonda(tres, casiUno);
    expect(estado.conceptos).toEqual([par(1).id, par(2).id, par(3).id]);
    expect(estado.definiciones).toEqual([par(2).id, par(3).id, par(1).id]);
  });

  it('keeps a shuffle that already differs, and a single pair as it is', () => {
    const valores = [0.999999, 0.999999, 0, 0.999999];
    const azar = () => valores.shift() ?? 0;
    const estado = iniciarRonda(tres, azar);
    expect(estado.conceptos).toEqual([par(1).id, par(2).id, par(3).id]);
    expect(estado.definiciones).toEqual([par(3).id, par(2).id, par(1).id]);
    expect(iniciarRonda([par(1)], casiUno).definiciones).toEqual([par(1).id]);
  });

  it('matches a concept with its definition, in either order', () => {
    let estado = rondaOrdenada(tres);
    estado = seleccionar(estado, 'concepto', par(1).id);
    expect(estado.seleccion.concepto).toBe(par(1).id);
    estado = seleccionar(estado, 'definicion', par(1).id);
    expect(estado.emparejados).toEqual([par(1).id]);
    expect(estado.ultimo).toEqual({ concepto: par(1).id, definicion: par(1).id, acierto: true });
    expect(estado.seleccion).toEqual({ concepto: null, definicion: null });

    estado = seleccionar(estado, 'definicion', par(2).id);
    expect(estado.ultimo).toBeNull();
    estado = seleccionar(estado, 'concepto', par(2).id);
    expect(estado.emparejados).toEqual([par(1).id, par(2).id]);
    expect(estaEmparejado(estado, par(2).id)).toBe(true);
  });

  it('counts a miss and clears the selection', () => {
    let estado = rondaOrdenada(tres);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(2).id);
    expect(estado.fallos).toBe(1);
    expect(estado.emparejados).toEqual([]);
    expect(estado.ultimo).toEqual({ concepto: par(1).id, definicion: par(2).id, acierto: false });
    expect(estado.seleccion).toEqual({ concepto: null, definicion: null });
  });

  it('changes or clears the selection on the same side', () => {
    let estado = rondaOrdenada(tres);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'concepto', par(2).id);
    expect(estado.seleccion.concepto).toBe(par(2).id);
    estado = seleccionar(estado, 'concepto', par(2).id);
    expect(estado.seleccion.concepto).toBeNull();
    expect(estado.fallos).toBe(0);
  });

  it('ignores matched pairs and unknown IDs', () => {
    let estado = rondaOrdenada(tres);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(1).id);
    expect(seleccionar(estado, 'concepto', par(1).id)).toBe(estado);
    expect(seleccionar(estado, 'definicion', par(1).id)).toBe(estado);
    expect(seleccionar(estado, 'concepto', 'no-existe')).toBe(estado);
  });

  it('checks by pair ID, so two pairs with the same text never give a false hit', () => {
    const gemelos = [par(1), { ...par(2), definicion: par(1).definicion }];
    let estado = rondaOrdenada(gemelos);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(2).id);
    expect(estado.ultimo?.acierto).toBe(false);
  });

  it('ends when every pair is matched, and then ignores input', () => {
    let estado = rondaOrdenada(tres);
    for (const p of tres) {
      estado = seleccionar(estado, 'concepto', p.id);
      estado = seleccionar(estado, 'definicion', p.id);
    }
    expect(rondaTerminada(estado)).toBe(true);
    expect(siguienteConceptoLibre(estado)).toBeUndefined();
    expect(seleccionar(estado, 'concepto', par(1).id)).toBe(estado);
  });

  it('an empty round is never finished', () => {
    expect(rondaTerminada(iniciarRonda([]))).toBe(false);
  });

  it('points at the next concept without a pair, in display order', () => {
    let estado = rondaOrdenada(tres);
    expect(siguienteConceptoLibre(estado)).toBe(par(1).id);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(1).id);
    expect(siguienteConceptoLibre(estado)).toBe(par(2).id);
  });

  it('scores matches and misses; misses do not subtract', () => {
    let estado = rondaOrdenada(tres);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(3).id);
    estado = seleccionar(estado, 'concepto', par(1).id);
    estado = seleccionar(estado, 'definicion', par(1).id);
    expect(puntuar(estado)).toEqual({ aciertos: 1, fallos: 1, total: 3 });
  });
});

describe('plural', () => {
  it('uses the singular only for one', () => {
    expect(plural(1, 'par', 'pares')).toBe('1 par');
    expect(plural(0, 'par', 'pares')).toBe('0 pares');
    expect(plural(2, 'fallo', 'fallos')).toBe('2 fallos');
  });
});

describe('anuncio', () => {
  const tres = [par(1), par(2), par(3)];
  const intento = (estado: EstadoRonda, concepto: ParJuego, definicion: ParJuego) =>
    seleccionar(seleccionar(estado, 'concepto', concepto.id), 'definicion', definicion.id);

  it('says nothing before a round or before the first attempt', () => {
    expect(anuncio(null)).toBe('');
    const estado = rondaOrdenada(tres);
    expect(anuncio(estado)).toBe('');
    expect(anuncio(seleccionar(estado, 'concepto', par(1).id))).toBe('');
  });

  it('announces a hit with the running count', () => {
    const estado = intento(rondaOrdenada(tres), par(2), par(2));
    expect(anuncio(estado)).toBe('Correcto: Concepto 2. Llevas 1 de 3.');
  });

  it('numbers each miss, so two misses in a row read differently', () => {
    const primero = intento(rondaOrdenada(tres), par(1), par(2));
    const segundo = intento(primero, par(1), par(3));
    expect(anuncio(primero)).toBe('Fallo 1: esa definición no es la de Concepto 1. Prueba otra.');
    expect(anuncio(segundo)).toBe('Fallo 2: esa definición no es la de Concepto 1. Prueba otra.');
  });

  it('sums up the round at the end, with plurals', () => {
    let estado = intento(rondaOrdenada(tres), par(1), par(2));
    for (const p of tres) estado = intento(estado, p, p);
    expect(anuncio(estado)).toBe('Ronda terminada: 3 pares y 1 fallo.');

    let limpia = rondaOrdenada([par(1), par(2)]);
    for (const p of [par(1), par(2)]) limpia = intento(limpia, p, p);
    expect(anuncio(limpia)).toBe('Ronda terminada: 2 pares y 0 fallos.');
  });
});
