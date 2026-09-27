import { describe, expect, it } from 'vitest';
import type { Esperado } from '../../content/schemas';
import { compareResult } from './compare-result';

const esperado = (overrides: Partial<Esperado>): Esperado => ({
  columnas: ['nombre', 'total'],
  orden_importa: true,
  muta: false,
  ...overrides,
});

const actual = {
  columns: ['nombre', 'total'],
  rows: [
    ['Ana', 3],
    ['Luis', null],
    ['Ana', 3],
  ],
};

describe('compareResult', () => {
  it('matches identical ordered rows', () => {
    expect(compareResult(actual, esperado({ filas: actual.rows }))).toBeNull();
  });

  it('reports different columns', () => {
    expect(compareResult(actual, esperado({ columnas: ['nombre'], num_filas: 3 }))).toMatch(
      /Columnas distintas/,
    );
  });

  it('checks only the row count when num_filas is given', () => {
    expect(compareResult(actual, esperado({ num_filas: 3 }))).toBeNull();
    expect(compareResult(actual, esperado({ num_filas: 2 }))).toMatch(/2 filas y salieron 3/);
  });

  it('reports a different number of rows', () => {
    expect(compareResult(actual, esperado({ filas: [['Ana', 3]] }))).toMatch(
      /1 filas y salieron 3/,
    );
  });

  it('reports the first row that differs when order matters', () => {
    const filas = [
      ['Ana', 3],
      ['Ana', 3],
      ['Luis', null],
    ];
    expect(compareResult(actual, esperado({ filas }))).toMatch(/La fila 2 no coincide/);
  });

  it('ignores order but not duplicates when order does not matter', () => {
    const reordenadas = [
      ['Luis', null],
      ['Ana', 3],
      ['Ana', 3],
    ];
    expect(
      compareResult(actual, esperado({ filas: reordenadas, orden_importa: false })),
    ).toBeNull();

    const sinDuplicado = [
      ['Luis', null],
      ['Ana', 3],
      ['Luis', null],
    ];
    expect(compareResult(actual, esperado({ filas: sinDuplicado, orden_importa: false }))).toMatch(
      /no coincide/,
    );
  });

  it('sorts mixed cell types canonically', () => {
    const mixed = { columns: ['v'], rows: [['b'], [2], [null], ['a'], [1]] };
    const filas = [[1], ['a'], [null], [2], ['b']];
    expect(
      compareResult(mixed, esperado({ columnas: ['v'], filas, orden_importa: false })),
    ).toBeNull();
  });

  it('tolerates floating point noise but not real differences', () => {
    const suma = { columns: ['s'], rows: [[0.1 + 0.2]] };
    expect(compareResult(suma, esperado({ columnas: ['s'], filas: [[0.3]] }))).toBeNull();
    expect(compareResult(suma, esperado({ columnas: ['s'], filas: [[0.31]] }))).toMatch(
      /no coincide/,
    );
  });

  it('does not confuse a number with its text', () => {
    const texto = { columns: ['v'], rows: [['3']] };
    expect(compareResult(texto, esperado({ columnas: ['v'], filas: [[3]] }))).toMatch(
      /no coincide/,
    );
  });
});
