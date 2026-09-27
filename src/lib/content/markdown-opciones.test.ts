import type { Element } from 'hast';
import { describe, expect, it } from 'vitest';
import { alinearConClase, esUrlSegura } from './markdown-opciones';

describe('esUrlSegura', () => {
  it.each([
    'https://a.es',
    'http://a.es',
    'mailto:a@b.es',
    '/ruta',
    '#ancla',
    './x',
    '?q=1',
    'x/y',
  ])('accepts %s', (url) => {
    expect(esUrlSegura(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',
    ' javascript:alert(1)',
    'vbscript:x',
    'data:text/html,x',
    'file:///etc/passwd',
  ])('rejects %s', (url) => {
    expect(esUrlSegura(url)).toBe(false);
  });
});

const celda = (properties: Element['properties']): Element => ({
  type: 'element',
  tagName: 'td',
  properties,
  children: [],
});

describe('alinearConClase', () => {
  it('leaves cells without style alone', () => {
    expect(alinearConClase(celda({}))).toBeUndefined();
  });

  it('turns the alignment into a class, keeping other classes', () => {
    expect(alinearConClase(celda({ style: 'text-align: right', className: ['x'] }))).toEqual(
      celda({ className: ['x', 'align-right'] }),
    );
  });

  it('drops any other inline style', () => {
    expect(alinearConClase(celda({ style: 'color: red' }))).toEqual(celda({}));
  });
});
