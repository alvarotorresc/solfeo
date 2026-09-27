import { describe, expect, it } from 'vitest';
import { bancoDelNivel } from './banco-del-nivel';

const tests = [
  {
    id: 'bases-de-datos/fundamentos',
    data: {
      preguntas: [
        { id: 'bd-f-t01', leccion: 'bd-f-01' },
        { id: 'bd-f-t02', leccion: 'bd-f-02' },
      ],
    },
  },
  {
    id: 'bases-de-datos/intermedio',
    data: { preguntas: [{ id: 'bd-i-t01', leccion: 'bd-i-01' }] },
  },
];

const lecciones = [
  { id: 'bd-f-01', titulo: 'Uno', href: '/bases-de-datos/fundamentos/01-uno' },
  { id: 'bd-f-02', titulo: 'Dos', href: null },
];

describe('bancoDelNivel', () => {
  it('picks the level entry and keeps only questions of published lessons', () => {
    expect(bancoDelNivel(tests, 'bases-de-datos', 'fundamentos', lecciones)).toEqual([
      { id: 'bd-f-t01', leccion: 'bd-f-01' },
    ]);
  });

  it('gives an empty bank when the level has no entry', () => {
    expect(bancoDelNivel(tests, 'bases-de-datos', 'avanzado', lecciones)).toEqual([]);
    expect(bancoDelNivel([], 'bases-de-datos', 'fundamentos', lecciones)).toEqual([]);
  });

  it('does not mix up modules', () => {
    expect(bancoDelNivel(tests, 'redes', 'fundamentos', lecciones)).toEqual([]);
  });
});
