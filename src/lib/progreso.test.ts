import { describe, expect, it } from 'vitest';
import {
  CLAVE_PROGRESO,
  borrarLecciones,
  cambiarNivel,
  contarHechas,
  estaHecha,
  guardarProgreso,
  hechasSeguidas,
  leerProgreso,
  marcarHecha,
  nivelDeLeccion,
  parsearProgreso,
  progresoVacio,
  siguientePendiente,
  type Progreso,
} from './progreso';

function almacenEnMemoria(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => {
      datos.set(clave, valor);
    },
  };
}

const conHechas: Progreso = {
  nivel: 'intermedio',
  hechas: { fundamentos: ['bd-f-01', 'bd-f-04'], intermedio: ['bd-i-02'], avanzado: [] },
};

describe('parsearProgreso', () => {
  it('reads valid progress', () => {
    expect(parsearProgreso(JSON.stringify(conHechas))).toEqual(conHechas);
  });

  it.each([
    ['nothing stored', null],
    ['broken JSON', '{"nivel":'],
    ['wrong shape', '{"nivel":"experto","hechas":{}}'],
    [
      'bad lesson ID',
      '{"nivel":"fundamentos","hechas":{"fundamentos":["x"],"intermedio":[],"avanzado":[]}}',
    ],
    ['a plain string', '"hola"'],
  ])('falls back to empty progress with %s', (_caso, texto) => {
    expect(parsearProgreso(texto)).toEqual(progresoVacio());
  });
});

describe('leerProgreso and guardarProgreso', () => {
  it('round-trips through a single versioned key', () => {
    const almacen = almacenEnMemoria();
    expect(guardarProgreso(almacen, conHechas)).toBe(true);
    expect([...almacen.datos.keys()]).toEqual([CLAVE_PROGRESO]);
    expect(CLAVE_PROGRESO).toBe('solfeo:v1:progreso');
    expect(leerProgreso(almacen)).toEqual(conHechas);
  });

  it('gives empty progress when reading throws', () => {
    const almacen = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(leerProgreso(almacen)).toEqual(progresoVacio());
  });

  it('gives empty progress without storage', () => {
    expect(leerProgreso(undefined)).toEqual(progresoVacio());
  });

  it('reports false when writing throws or there is no storage', () => {
    const lleno = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(guardarProgreso(lleno, conHechas)).toBe(false);
    expect(guardarProgreso(undefined, conHechas)).toBe(false);
  });
});

describe('nivelDeLeccion', () => {
  it.each([
    ['bd-f-04', 'fundamentos'],
    ['bd-i-01', 'intermedio'],
    ['bd-a-08', 'avanzado'],
    ['bd-x-01', undefined],
    ['nada', undefined],
  ])('%s → %s', (id, nivel) => {
    expect(nivelDeLeccion(id)).toBe(nivel);
  });
});

describe('marcarHecha', () => {
  it('adds the lesson to its own level, sorted', () => {
    const despues = marcarHecha(conHechas, 'bd-f-03');
    expect(despues.hechas.fundamentos).toEqual(['bd-f-01', 'bd-f-03', 'bd-f-04']);
    expect(despues.hechas.intermedio).toEqual(['bd-i-02']);
    expect(conHechas.hechas.fundamentos).toEqual(['bd-f-01', 'bd-f-04']);
  });

  it('accepts lessons numbered past 8, since levels have no fixed size', () => {
    const despues = marcarHecha(marcarHecha(conHechas, 'bd-f-12'), 'bd-f-103');
    expect(estaHecha(despues, 'bd-f-12')).toBe(true);
    expect(estaHecha(despues, 'bd-f-103')).toBe(true);
    expect(parsearProgreso(JSON.stringify(despues))).toEqual(despues);
  });

  it('does not depend on the selected level', () => {
    expect(marcarHecha(progresoVacio('avanzado'), 'bd-f-02').hechas.fundamentos).toEqual([
      'bd-f-02',
    ]);
  });

  it('returns the same object when the lesson is already done or the ID is invalid', () => {
    expect(marcarHecha(conHechas, 'bd-f-04')).toBe(conHechas);
    expect(marcarHecha(conHechas, 'bd-f-9')).toBe(conHechas);
    expect(marcarHecha(conHechas, 'basura')).toBe(conHechas);
  });
});

describe('estaHecha', () => {
  it('checks the lesson level', () => {
    expect(estaHecha(conHechas, 'bd-f-04')).toBe(true);
    expect(estaHecha(conHechas, 'bd-f-05')).toBe(false);
    expect(estaHecha(conHechas, 'basura')).toBe(false);
  });
});

describe('cambiarNivel', () => {
  it('changes only the level and keeps progress', () => {
    const despues = cambiarNivel(conHechas, 'avanzado');
    expect(despues.nivel).toBe('avanzado');
    expect(despues.hechas).toBe(conHechas.hechas);
  });

  it('returns the same object when the level does not change', () => {
    expect(cambiarNivel(conHechas, 'intermedio')).toBe(conHechas);
  });
});

describe('borrarLecciones', () => {
  it('forgets the lessons and keeps the level', () => {
    expect(borrarLecciones(conHechas)).toEqual(progresoVacio('intermedio'));
  });
});

describe('contarHechas and siguientePendiente', () => {
  const orden = ['bd-f-01', 'bd-f-02', 'bd-f-03', 'bd-f-04'];

  it('counts the done lessons of a list', () => {
    expect(contarHechas(conHechas, orden)).toBe(2);
  });

  it('counts the lessons done in a row from the start', () => {
    expect(hechasSeguidas(conHechas, orden)).toBe(1);
    expect(hechasSeguidas(conHechas, ['bd-f-04', 'bd-f-01'])).toBe(2);
    expect(hechasSeguidas(conHechas, ['bd-f-02', 'bd-f-01'])).toBe(0);
  });

  it('follows the order of the list, not the ID numbers', () => {
    const conIntercalada = ['bd-f-01', 'bd-f-09', 'bd-f-02', 'bd-f-04'];
    expect(siguientePendiente(conHechas, conIntercalada)).toBe('bd-f-09');
    expect(hechasSeguidas(marcarHecha(conHechas, 'bd-f-09'), conIntercalada)).toBe(2);
  });

  it('finds the first lesson not done yet', () => {
    expect(siguientePendiente(conHechas, orden)).toBe('bd-f-02');
    expect(siguientePendiente(conHechas, ['bd-f-01', 'bd-f-04'])).toBeUndefined();
  });
});
