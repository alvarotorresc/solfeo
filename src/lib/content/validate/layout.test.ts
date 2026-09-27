import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classify, listFiles } from './layout';

describe('classify', () => {
  it.each([
    ['modulos.yaml', { tipo: 'modulos' }],
    ['schemas.ts', { tipo: 'codigo' }],
    ['content.test.ts', { tipo: 'codigo' }],
    ['bd/temario.yaml', { tipo: 'temario', modulo: 'bd' }],
    ['bd/pares.yaml', { tipo: 'pares', modulo: 'bd' }],
    ['bd/intermedio/test.yaml', { tipo: 'test', modulo: 'bd', nivel: 'intermedio' }],
    [
      'bd/avanzado/casos/bd-a-caso-01.yaml',
      { tipo: 'caso', modulo: 'bd', nivel: 'avanzado', nombre: 'bd-a-caso-01' },
    ],
    [
      'bd/fundamentos/04-x/leccion.md',
      { tipo: 'leccion', modulo: 'bd', nivel: 'fundamentos', carpeta: '04-x' },
    ],
    [
      'bd/fundamentos/04-x/quiz.yaml',
      { tipo: 'quiz', modulo: 'bd', nivel: 'fundamentos', carpeta: '04-x' },
    ],
    [
      'bd/fundamentos/04-x/sql.yaml',
      { tipo: 'sql', modulo: 'bd', nivel: 'fundamentos', carpeta: '04-x' },
    ],
  ])('places %s', (archivo, ubicacion) => {
    expect(classify(archivo)).toEqual(ubicacion);
  });

  it.each([
    'README.md',
    'bd/notas.md',
    'bd/fundamentos/notas.md',
    'bd/basico/test.yaml',
    'bd/fundamentos/casos/bd-f-caso-01.yml',
    'bd/fundamentos/04-x/notas.md',
    'bd/fundamentos/04-x/constructor',
    'bd/fundamentos/04-x/img/diagrama.png',
  ])('rejects %s', (archivo) => {
    expect(classify(archivo)).toBeNull();
  });
});

describe('listFiles', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('lists real files without following symlinks, and reports the symlinks apart', () => {
    dir = mkdtempSync(join(tmpdir(), 'solfeo-layout-'));
    writeFileSync(join(dir, 'real.txt'), 'x');
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', 'inside.txt'), 'y');
    symlinkSync(join(dir, 'sub'), join(dir, 'atajo-dir'));
    symlinkSync(join(dir, 'real.txt'), join(dir, 'atajo-archivo.txt'));

    expect(listFiles(dir)).toEqual({
      archivos: ['real.txt', 'sub/inside.txt'],
      simbolicos: ['atajo-archivo.txt', 'atajo-dir'],
    });
  });

  it('does not loop on a symlink that points back into an ancestor directory', () => {
    dir = mkdtempSync(join(tmpdir(), 'solfeo-layout-'));
    mkdirSync(join(dir, 'sub'));
    symlinkSync(dir, join(dir, 'sub', 'ciclo'));

    expect(listFiles(dir)).toEqual({ archivos: [], simbolicos: ['sub/ciclo'] });
  });
});
