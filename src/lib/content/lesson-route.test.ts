import { describe, expect, it } from 'vitest';
import { lessonRouteParams } from './lesson-route';

describe('lessonRouteParams', () => {
  it('takes module, level and lesson folder from the file path', () => {
    expect(
      lessonRouteParams(
        'src/content/bases-de-datos/fundamentos/04-consultar-con-select/leccion.md',
      ),
    ).toEqual({
      modulo: 'bases-de-datos',
      nivel: 'fundamentos',
      leccion: '04-consultar-con-select',
    });
  });

  it('accepts Windows separators', () => {
    expect(lessonRouteParams('src\\content\\bd\\avanzado\\01-x\\leccion.md').leccion).toBe('01-x');
  });

  it.each(['src/content/bases-de-datos/fundamentos/quiz.yaml', 'leccion.md'])(
    'rejects %s',
    (path) => {
      expect(() => lessonRouteParams(path)).toThrow(/Ruta de lección inesperada/);
    },
  );
});
