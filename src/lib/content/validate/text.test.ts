import { describe, expect, it } from 'vitest';
import { isYesNoQuestion, normalizeStatement } from './text';

describe('normalizeStatement', () => {
  it('ignores case, repeated spaces and closing punctuation', () => {
    expect(normalizeStatement('  ¿Qué hace   WHERE?\n')).toBe(
      normalizeStatement('¿qué hace where'),
    );
  });

  it('keeps statements that differ in content apart', () => {
    expect(normalizeStatement('¿Qué hace WHERE?')).not.toBe(
      normalizeStatement('¿Qué hace HAVING?'),
    );
  });
});

describe('isYesNoQuestion', () => {
  it.each([
    '¿Es correcto usar SELECT *?',
    '¿Hay alguna forma de evitarlo?',
    'Si falla el disco, ¿puede perderse el pedido?',
    '¿DEBERÍA añadir un índice?',
    '¿No es mejor un índice?',
    '¿No hay otra forma?',
    'Si falla, ¿NO debería reintentarse?',
  ])('flags «%s»', (texto) => {
    expect(isYesNoQuestion(texto)).toBe(true);
  });

  it.each([
    '¿Cómo lo investigarías?',
    'Resulta que hay pedidos cancelados. ¿Dónde pondrías esa condición?',
    'Explica qué comprobarías.',
    'Funciona, ¿no?',
    '¿Nombrarías otra causa?',
  ])('accepts «%s»', (texto) => {
    expect(isYesNoQuestion(texto)).toBe(false);
  });
});
