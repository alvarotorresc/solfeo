import type { Element } from 'hast';
import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { codeFrame, enmarcarCodigo, etiquetaDeLenguaje } from './code-frame';

const pre = (properties: Element['properties']): Element => ({
  type: 'element',
  tagName: 'pre',
  properties,
  children: [{ type: 'element', tagName: 'code', properties: {}, children: [] }],
});

describe('etiquetaDeLenguaje', () => {
  it('names known languages and falls back to the raw name', () => {
    expect(etiquetaDeLenguaje(pre({ dataLanguage: 'sql' }))).toBe('SQL');
    expect(etiquetaDeLenguaje(pre({ dataLanguage: 'bash' }))).toBe('bash');
  });

  it('says «Código» without a language', () => {
    expect(etiquetaDeLenguaje(pre({}))).toBe('Código');
  });
});

describe('enmarcarCodigo', () => {
  it('wraps the block in a figure with a header and a copy button', () => {
    const marco = enmarcarCodigo(pre({ dataLanguage: 'sql', className: ['language-sql'] }));
    expect(marco?.tagName).toBe('figure');
    expect(marco?.properties).toEqual({ className: ['code'] });
    const [cabecera, bloque] = marco?.children as Element[];
    expect(cabecera?.properties).toEqual({ className: ['code-head'] });
    expect(JSON.stringify(cabecera)).toContain('"value":"SQL"');
    expect(JSON.stringify(cabecera)).toContain('"value":"Copiar"');
    expect(bloque?.tagName).toBe('pre');
    expect(bloque?.properties).toMatchObject({ dataFramed: '', className: ['language-sql'] });
  });

  it('leaves an already framed block alone, so it never wraps twice', () => {
    expect(enmarcarCodigo(pre({ dataFramed: '' }))).toBeUndefined();
  });
});

describe('codeFrame in the Markdown pipeline', () => {
  it('frames each code block exactly once', () => {
    const { html } = markdownToHtml('Texto\n\n```sql id=q1\nSELECT 1;\n```\n', {
      hastPlugins: [codeFrame],
    });
    expect(html.match(/<figure class="code">/g)).toHaveLength(1);
    expect(html).toContain('<button type="button" class="copy" data-copy="">');
    expect(html).toContain('<span class="icon" aria-hidden="true">content_copy</span>');
    expect(html).toContain('SELECT 1;');
  });
});
