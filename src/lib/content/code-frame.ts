/**
 * Markdown HTML plugin: wraps each highlighted code block in a frame with its language and a copy
 * button, at build time, so the page does not shift when the copy script loads. It runs after the
 * Prism highlighter in Astro's Markdown processor; returning a node replaces the visited one.
 */
import type { Element, ElementContent, Properties } from 'hast';
import { defineHastPlugin } from 'satteri';

const elemento = (
  tagName: string,
  properties: Properties,
  children: ElementContent[] = [],
): Element => ({ type: 'element', tagName, properties, children });

const texto = (value: string): ElementContent => ({ type: 'text', value });

const NOMBRES: Record<string, string> = { sql: 'SQL' };

/** Label shown in the frame header for a `pre` element. */
export function etiquetaDeLenguaje(pre: Element): string {
  const lenguaje = pre.properties['dataLanguage'];
  if (typeof lenguaje !== 'string' || lenguaje === '') return 'Código';
  return NOMBRES[lenguaje] ?? lenguaje;
}

/** Returns the framed block, or undefined when the `pre` is already framed. */
export function enmarcarCodigo(pre: Element): Element | undefined {
  if (pre.properties['dataFramed'] !== undefined) return undefined;
  const marcado: Element = { ...pre, properties: { ...pre.properties, dataFramed: '' } };
  const icono = elemento('span', { className: ['icon'], ariaHidden: 'true' }, [
    texto('content_copy'),
  ]);
  const boton = elemento('button', { type: 'button', className: ['copy'], dataCopy: '' }, [
    icono,
    elemento('span', { className: ['copy-label'] }, [texto('Copiar')]),
  ]);
  const cabecera = elemento('div', { className: ['code-head'] }, [
    elemento('span', {}, [texto(etiquetaDeLenguaje(pre))]),
    boton,
  ]);
  return elemento('figure', { className: ['code'] }, [cabecera, marcado]);
}

export const codeFrame = defineHastPlugin({
  name: 'solfeo-code-frame',
  element: {
    filter: ['pre'],
    visit: (node: Element) => enmarcarCodigo(node),
  },
});
