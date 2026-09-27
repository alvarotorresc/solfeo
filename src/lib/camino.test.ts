import { describe, expect, it } from 'vitest';
import type { Temario } from '../content/schemas';
import { caminoDelModulo, rutaDeLeccion, vecinas } from './camino';

const temario: Temario = {
  modulo: 'bases-de-datos',
  lecciones: [
    { id: 'bd-f-02', nivel: 'fundamentos', orden: 2, carpeta: '02-dos', titulo: 'Dos' },
    { id: 'bd-f-01', nivel: 'fundamentos', orden: 1, carpeta: '01-uno', titulo: 'Uno' },
    { id: 'bd-f-03', nivel: 'fundamentos', orden: 3, carpeta: '03-tres', titulo: 'Tres' },
    { id: 'bd-i-01', nivel: 'intermedio', orden: 1, carpeta: '01-i', titulo: 'I uno' },
  ],
};

describe('rutaDeLeccion', () => {
  it('joins module, level and folder', () => {
    expect(rutaDeLeccion('bases-de-datos', 'fundamentos', '04-x')).toBe(
      '/bases-de-datos/fundamentos/04-x',
    );
  });
});

describe('caminoDelModulo', () => {
  const camino = caminoDelModulo(temario, new Set(['bd-f-02']));

  it('groups lessons by level in syllabus order', () => {
    expect(camino.fundamentos.map((l) => l.id)).toEqual(['bd-f-01', 'bd-f-02', 'bd-f-03']);
    expect(camino.intermedio.map((l) => l.id)).toEqual(['bd-i-01']);
    expect(camino.avanzado).toEqual([]);
  });

  it('links only the lessons that have content', () => {
    expect(camino.fundamentos.map((l) => l.href)).toEqual([
      null,
      '/bases-de-datos/fundamentos/02-dos',
      null,
    ]);
  });
});

describe('vecinas', () => {
  const camino = caminoDelModulo(temario, new Set());

  it('finds previous and next lessons of the same level', () => {
    const { anterior, siguiente, posicion, total } = vecinas(camino, 'fundamentos', 'bd-f-02');
    expect(anterior?.id).toBe('bd-f-01');
    expect(siguiente?.id).toBe('bd-f-03');
    expect({ posicion, total }).toEqual({ posicion: 2, total: 3 });
  });

  it('has no previous lesson at the start and no next one at the end', () => {
    expect(vecinas(camino, 'fundamentos', 'bd-f-01').anterior).toBeUndefined();
    expect(vecinas(camino, 'fundamentos', 'bd-f-03').siguiente).toBeUndefined();
  });

  it('throws for a lesson outside the syllabus', () => {
    expect(() => vecinas(camino, 'intermedio', 'bd-f-01')).toThrow(/no está en el temario/);
  });
});

describe('a level of any size', () => {
  const tema = (numero: number, orden: number) => {
    const n = String(numero).padStart(2, '0');
    return { id: `bd-f-${n}`, nivel: 'fundamentos' as const, orden, carpeta: `${n}-x`, titulo: n };
  };

  it('keeps every lesson of a ten-lesson level', () => {
    const diez = Array.from({ length: 10 }, (_, i) => tema(i + 1, i + 1)).reverse();
    const camino = caminoDelModulo({ modulo: 'bases-de-datos', lecciones: diez }, new Set());
    expect(camino.fundamentos).toHaveLength(10);
    expect(vecinas(camino, 'fundamentos', 'bd-f-10')).toMatchObject({ posicion: 10, total: 10 });
  });

  it('places an inserted lesson by its order, not by its ID number', () => {
    const lecciones = [tema(1, 10), tema(2, 20), tema(3, 30), tema(4, 15)];
    const camino = caminoDelModulo({ modulo: 'bases-de-datos', lecciones }, new Set(['bd-f-04']));
    expect(camino.fundamentos.map((l) => l.id)).toEqual([
      'bd-f-01',
      'bd-f-04',
      'bd-f-02',
      'bd-f-03',
    ]);
    expect(camino.fundamentos[1]?.href).toBe('/bases-de-datos/fundamentos/04-x');
    const { anterior, siguiente, posicion, total } = vecinas(camino, 'fundamentos', 'bd-f-04');
    expect([anterior?.id, siguiente?.id, posicion, total]).toEqual(['bd-f-01', 'bd-f-02', 2, 4]);
  });
});
