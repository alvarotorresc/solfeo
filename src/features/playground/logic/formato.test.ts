import { describe, expect, it } from 'vitest';
import {
  columnasNumericas,
  formatearCelda,
  formatearError,
  lineaEstado,
  mensajeDeError,
  textoEstado,
} from './formato';

describe('mensajeDeError', () => {
  it('takes the message of an Error and stringifies anything else', () => {
    expect(mensajeDeError(new Error('se rompió'))).toBe('se rompió');
    expect(mensajeDeError('texto')).toBe('texto');
    expect(mensajeDeError(42)).toBe('42');
  });
});

describe('formatearCelda', () => {
  it('shows NULL, numbers, text and BLOBs', () => {
    expect(formatearCelda(null)).toBe('NULL');
    expect(formatearCelda(12.5)).toBe('12.5');
    expect(formatearCelda(0)).toBe('0');
    expect(formatearCelda('Madrid')).toBe('Madrid');
    expect(formatearCelda('')).toBe('');
    expect(formatearCelda({ tipo: 'blob', bytes: 3 })).toBe('BLOB (3 bytes)');
    expect(formatearCelda({ tipo: 'recortada', texto: 'abc', longitud: 5000 })).toBe('abc…');
  });
});

describe('columnasNumericas', () => {
  it('marks columns whose values are all numbers, ignoring NULLs', () => {
    const filas = [
      [1, 'a', null, 2.5],
      [null, 'b', null, 'x'],
      [3, 'c', null, 1],
    ];
    expect(columnasNumericas(filas, 4)).toEqual([true, false, false, false]);
  });

  it('has no numeric columns when there are no rows', () => {
    expect(columnasNumericas([], 2)).toEqual([false, false]);
  });
});

describe('formatearError', () => {
  it.each([
    ['no such table: clientez', 'No existe la tabla «clientez».'],
    ['no such column: nombr', 'No existe la columna «nombr».'],
    ['no such function: SUMA', 'No existe la función «SUMA».'],
    ['near "SELEC": syntax error', 'Error de sintaxis cerca de «SELEC».'],
    ['incomplete input', 'La consulta está incompleta. ¿Falta cerrar un paréntesis o una comilla?'],
    [
      'ambiguous column name: id',
      'La columna «id» está en varias tablas: indica cuál, como tabla.id.',
    ],
    [
      'UNIQUE constraint failed: clientes.email',
      'Ya hay una fila con ese valor en «clientes.email».',
    ],
    ['NOT NULL constraint failed: productos.nombre', '«productos.nombre» no puede quedar a NULL.'],
    ['FOREIGN KEY constraint failed', 'La operación rompería una clave foránea.'],
    ['table pedidos already exists', 'La tabla «pedidos» ya existe.'],
  ])('translates «%s» and keeps the original', (original, mensaje) => {
    expect(formatearError(new Error(original))).toEqual({ mensaje, detalle: original });
  });

  it('passes unknown messages through untouched', () => {
    expect(formatearError(new Error('La consulta tarda más de 2000 ms'))).toEqual({
      mensaje: 'La consulta tarda más de 2000 ms',
    });
    expect(formatearError('algo raro')).toEqual({ mensaje: 'algo raro' });
  });

  it('never returns an empty message', () => {
    expect(formatearError(new Error('  '))).toEqual({ mensaje: 'Error desconocido de SQLite.' });
  });
});

describe('textoEstado', () => {
  const esquema: never[] = [];
  const filas = (n: number, truncado = false) =>
    textoEstado({
      tipo: 'filas',
      columnas: ['x'],
      filas: Array.from({ length: n }, (_, i) => [i]),
      truncado,
      esquema,
    });

  it('counts rows, in singular and plural', () => {
    expect(filas(0)).toBe('0 filas.');
    expect(filas(1)).toBe('1 fila.');
    expect(filas(12)).toBe('12 filas.');
  });

  it('says when the rows were cut', () => {
    expect(filas(500, true)).toBe('Más de 500 filas: se muestran las 500 primeras.');
  });

  it('reports changes of statements without results', () => {
    expect(textoEstado({ tipo: 'hecho', cambios: 0, esquema })).toBe(
      'Hecho. Ninguna fila modificada.',
    );
    expect(textoEstado({ tipo: 'hecho', cambios: 1, esquema })).toBe('Hecho. 1 fila modificada.');
    expect(textoEstado({ tipo: 'hecho', cambios: 7, esquema })).toBe('Hecho. 7 filas modificadas.');
  });

  it('reports errors and the hard time limit', () => {
    expect(textoEstado({ tipo: 'error', mensaje: 'No existe la tabla «x».' })).toBe(
      'Error: No existe la tabla «x».',
    );
    expect(textoEstado({ tipo: 'tiempo', limiteMs: 5000 })).toBe(
      'La consulta tardó más de 5 s y se ha cortado. La base ha vuelto a su estado inicial.',
    );
  });
});

describe('lineaEstado', () => {
  it('shows the phase while busy', () => {
    expect(lineaEstado('cargando', null)).toBe('Cargando la base de ejemplo…');
    expect(lineaEstado('ejecutando', { tipo: 'reiniciada' })).toBe('Ejecutando…');
    expect(lineaEstado('fallo', null, 'No carga.')).toBe('No carga.');
  });

  it('keeps the reason in view while the database reloads after a hard stop', () => {
    expect(lineaEstado('cargando', { tipo: 'tiempo', limiteMs: 5000 })).toBe(
      'La consulta tardó más de 5 s y se ha cortado. La base ha vuelto a su estado inicial. Cargando la base de ejemplo…',
    );
    expect(lineaEstado('cargando', { tipo: 'error', mensaje: 'Se cayó.', reiniciada: true })).toBe(
      'Error: Se cayó. Cargando la base de ejemplo…',
    );
    expect(lineaEstado('cargando', { tipo: 'error', mensaje: 'Otro.' })).toBe(
      'Cargando la base de ejemplo…',
    );
  });

  it('shows the last result once ready', () => {
    expect(lineaEstado('listo', null)).toBe('Base lista.');
    expect(lineaEstado('listo', { tipo: 'reiniciada' })).toBe(
      'Base reiniciada con los datos de ejemplo.',
    );
    expect(lineaEstado('listo', { tipo: 'hecho', cambios: 1, esquema: [] })).toBe(
      'Hecho. 1 fila modificada.',
    );
  });
});
