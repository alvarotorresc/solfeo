/**
 * Levels and lesson ID format. Plain constants with no validation library, so browser code can
 * use them without pulling the content schemas into the bundle. `content/schemas.ts` builds on
 * these.
 */
export const NIVELES = ['fundamentos', 'intermedio', 'avanzado'] as const;
export type Nivel = (typeof NIVELES)[number];

/** Letter used for each level inside IDs such as `bd-f-04`. */
export const LETRA_NIVEL: Record<Nivel, string> = {
  fundamentos: 'f',
  intermedio: 'i',
  avanzado: 'a',
};

/** Lesson ID: module prefix, level letter and a number of two or more digits, e.g. `bd-f-04`. */
export const PATRON_LECCION_ID = /^[a-z]+-[fia]-[0-9]{2,}$/;
