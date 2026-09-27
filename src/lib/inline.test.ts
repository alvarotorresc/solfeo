import { describe, expect, it } from 'vitest';
import { textoPlano, trozosInline } from './inline';

describe('trozosInline', () => {
  it('splits inline code from text', () => {
    expect(trozosInline('Ejecutas `SELECT 1;` dos veces')).toEqual([
      { tipo: 'texto', texto: 'Ejecutas ' },
      { tipo: 'codigo', texto: 'SELECT 1;' },
      { tipo: 'texto', texto: ' dos veces' },
    ]);
  });

  it('handles code at the edges and plain text', () => {
    expect(trozosInline('`a` y `b`')).toEqual([
      { tipo: 'codigo', texto: 'a' },
      { tipo: 'texto', texto: ' y ' },
      { tipo: 'codigo', texto: 'b' },
    ]);
    expect(trozosInline('sin marcas')).toEqual([{ tipo: 'texto', texto: 'sin marcas' }]);
    expect(trozosInline('')).toEqual([]);
  });

  it('reads strong and emphasis', () => {
    expect(trozosInline('Es **siempre** así, *casi* _nunca_')).toEqual([
      { tipo: 'texto', texto: 'Es ' },
      { tipo: 'fuerte', texto: 'siempre' },
      { tipo: 'texto', texto: ' así, ' },
      { tipo: 'enfasis', texto: 'casi' },
      { tipo: 'texto', texto: ' ' },
      { tipo: 'enfasis', texto: 'nunca' },
    ]);
  });

  it('keeps markers inside code literal', () => {
    expect(trozosInline('`SELECT * FROM t WHERE a = **b**`')).toEqual([
      { tipo: 'codigo', texto: 'SELECT * FROM t WHERE a = **b**' },
    ]);
  });

  it('leaves loose asterisks and snake_case names alone', () => {
    expect(trozosInline('SELECT * FROM t; a * b')).toEqual([
      { tipo: 'texto', texto: 'SELECT * FROM t; a * b' },
    ]);
    expect(trozosInline('la columna precio_unitario y cliente_id')).toEqual([
      { tipo: 'texto', texto: 'la columna precio_unitario y cliente_id' },
    ]);
  });

  it('does not read COUNT(*) as emphasis markers', () => {
    const texto = 'COUNT(*) cuenta filas y COUNT(*) también, pero *esto* sí va en cursiva';
    expect(trozosInline(texto)).toEqual([
      { tipo: 'texto', texto: 'COUNT(*) cuenta filas y COUNT(*) también, pero ' },
      { tipo: 'enfasis', texto: 'esto' },
      { tipo: 'texto', texto: ' sí va en cursiva' },
    ]);
  });

  it('keeps an unpaired marker as text', () => {
    expect(trozosInline('a ` b')).toEqual([{ tipo: 'texto', texto: 'a ` b' }]);
    expect(trozosInline('a **b')).toEqual([{ tipo: 'texto', texto: 'a **b' }]);
  });

  it('never produces HTML: angle brackets stay as text', () => {
    expect(trozosInline('<b>x</b> y `<i>`')).toEqual([
      { tipo: 'texto', texto: '<b>x</b> y ' },
      { tipo: 'codigo', texto: '<i>' },
    ]);
  });
});

describe('textoPlano', () => {
  it('drops the markers and keeps the words', () => {
    expect(textoPlano('Usa `IS NULL`, **nunca** `= NULL`')).toBe('Usa IS NULL, nunca = NULL');
  });
});
