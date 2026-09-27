/** Route params of a lesson page: `/{modulo}/{nivel}/{leccion}`. */
export interface LessonRouteParams {
  modulo: string;
  nivel: string;
  leccion: string;
}

/**
 * Derives the route of a lesson from its file path, e.g.
 * `src/content/bases-de-datos/fundamentos/04-consultar-con-select/leccion.md`
 * → `{ modulo: 'bases-de-datos', nivel: 'fundamentos', leccion: '04-consultar-con-select' }`.
 */
export function lessonRouteParams(filePath: string): LessonRouteParams {
  const parts = filePath.split(/[\\/]/);
  const [modulo, nivel, leccion, file] = parts.slice(-4);
  if (!modulo || !nivel || !leccion || file !== 'leccion.md') {
    throw new Error(`Ruta de lección inesperada: ${filePath}`);
  }
  return { modulo, nivel, leccion };
}
