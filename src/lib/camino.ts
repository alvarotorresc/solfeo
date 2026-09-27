/**
 * Builds what the path and the lesson navigation show from the syllabus and the lessons that
 * already have content. Pure: the pages pass in the collections.
 */
import type { Temario } from '../content/schemas';
import { NIVELES, type Nivel } from './niveles';

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  fundamentos: 'Fundamentos',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

export interface LeccionDelCamino {
  id: string;
  orden: number;
  titulo: string;
  /** Route of the lesson, or null while it has no content yet. */
  href: string | null;
}

export type CaminoDelModulo = Record<Nivel, LeccionDelCamino[]>;

export function rutaDeLeccion(modulo: string, nivel: Nivel, carpeta: string): string {
  return `/${modulo}/${nivel}/${carpeta}`;
}

/** Lessons of each level in syllabus order, linked only when their ID is in `publicadas`. */
export function caminoDelModulo(
  temario: Temario,
  publicadas: ReadonlySet<string>,
): CaminoDelModulo {
  const camino = Object.fromEntries(
    NIVELES.map((nivel) => [nivel, []]),
  ) as unknown as CaminoDelModulo;
  const ordenadas = [...temario.lecciones].sort((a, b) => a.orden - b.orden);
  for (const tema of ordenadas) {
    camino[tema.nivel].push({
      id: tema.id,
      orden: tema.orden,
      titulo: tema.titulo,
      href: publicadas.has(tema.id)
        ? rutaDeLeccion(temario.modulo, tema.nivel, tema.carpeta)
        : null,
    });
  }
  return camino;
}

export interface Vecinas {
  anterior: LeccionDelCamino | undefined;
  siguiente: LeccionDelCamino | undefined;
  posicion: number;
  total: number;
}

/** Previous and next lessons of the same level, whether or not they have content yet. */
export function vecinas(camino: CaminoDelModulo, nivel: Nivel, id: string): Vecinas {
  const lecciones = camino[nivel];
  const i = lecciones.findIndex((leccion) => leccion.id === id);
  if (i === -1) throw new Error(`La lección ${id} no está en el temario de ${nivel}`);
  return {
    anterior: lecciones[i - 1],
    siguiente: lecciones[i + 1],
    posicion: i + 1,
    total: lecciones.length,
  };
}
