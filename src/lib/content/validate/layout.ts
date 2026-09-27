import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NIVELES, type Nivel } from '../../niveles';

/** Where a file sits in the content tree, and so what it must contain. */
export type Ubicacion =
  | { tipo: 'codigo' }
  | { tipo: 'modulos' }
  | { tipo: 'temario' | 'pares'; modulo: string }
  | { tipo: 'test'; modulo: string; nivel: Nivel }
  | { tipo: 'caso'; modulo: string; nivel: Nivel; nombre: string }
  | { tipo: 'leccion' | 'quiz' | 'sql'; modulo: string; nivel: Nivel; carpeta: string };

const ARCHIVOS_DE_LECCION = {
  'leccion.md': 'leccion',
  'quiz.yaml': 'quiz',
  'sql.yaml': 'sql',
} as const;

const esNivel = (valor: string | undefined): valor is Nivel =>
  (NIVELES as readonly string[]).includes(valor ?? '');

const esArchivoDeLeccion = (nombre: string): nombre is keyof typeof ARCHIVOS_DE_LECCION =>
  Object.hasOwn(ARCHIVOS_DE_LECCION, nombre);

/**
 * Classifies a path relative to the content root, with forward slashes. Returns `null` for any
 * file outside the expected layout: the loaders would silently ignore it.
 */
export function classify(archivo: string): Ubicacion | null {
  const partes = archivo.split('/');
  const [modulo = '', nivel, tercero = '', cuarto = ''] = partes;

  if (partes.length === 1) {
    if (archivo === 'modulos.yaml') return { tipo: 'modulos' };
    return /^schemas.*\.ts$|\.test\.ts$/.test(archivo) ? { tipo: 'codigo' } : null;
  }
  if (partes.length === 2) {
    if (nivel === 'temario.yaml') return { tipo: 'temario', modulo };
    return nivel === 'pares.yaml' ? { tipo: 'pares', modulo } : null;
  }
  if (!esNivel(nivel)) return null;
  if (partes.length === 3) return tercero === 'test.yaml' ? { tipo: 'test', modulo, nivel } : null;
  if (partes.length !== 4) return null;
  if (tercero === 'casos') {
    return cuarto.endsWith('.yaml')
      ? { tipo: 'caso', modulo, nivel, nombre: cuarto.slice(0, -'.yaml'.length) }
      : null;
  }
  return esArchivoDeLeccion(cuarto)
    ? { tipo: ARCHIVOS_DE_LECCION[cuarto], modulo, nivel, carpeta: tercero }
    : null;
}

/** Every file under `raiz`, and every symlink found, relative and with forward slashes, sorted. */
export interface ArchivosYSimbolicos {
  archivos: string[];
  /** Symlinks to a file or to a directory: never followed, so never reported twice. */
  simbolicos: string[];
}

/**
 * Walks `raiz` by hand, hidden entries included. Only descends through `isDirectory()`, so a
 * symlink (to a file or to a directory) is never followed: it cannot escape `raiz` through a link
 * to an ancestor, nor loop forever on a cycle. Every symlink found is reported instead.
 */
export function listFiles(raiz: string): ArchivosYSimbolicos {
  const archivos: string[] = [];
  const simbolicos: string[] = [];

  function recorrer(relativo: string): void {
    for (const entrada of readdirSync(join(raiz, relativo), { withFileTypes: true })) {
      const ruta = relativo ? `${relativo}/${entrada.name}` : entrada.name;
      if (entrada.isSymbolicLink()) simbolicos.push(ruta);
      else if (entrada.isDirectory()) recorrer(ruta);
      else if (entrada.isFile()) archivos.push(ruta);
    }
  }

  recorrer('');
  return { archivos: archivos.sort(), simbolicos: simbolicos.sort() };
}
