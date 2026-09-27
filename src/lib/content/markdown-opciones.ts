/**
 * Markdown pipeline shared by lesson files (`astro.config.mjs`) and by Markdown stored in YAML
 * (`markdown.ts`), so both are sanitised and look the same.
 *
 * Content comes from the repo, but the model answers end up in a Preact island through
 * `dangerouslySetInnerHTML`, so the pipeline refuses anything that could turn into script:
 * - Raw HTML and HTML comments.
 * - Code fence languages outside `[\w+-]`: the Prism highlighter of `@astrojs/markdown-satteri`
 *   writes the language unescaped into `class` and `data-language`. The rest of the fence info
 *   (`id=q1`, `motivo="..."`) is allowed; it never reaches the HTML.
 * - Link, image and reference URLs with a scheme other than http, https or mailto.
 */
import type { Element } from 'hast';
import { defineHastPlugin, defineMdastPlugin } from 'satteri';
import { codeFrame } from './code-frame';

export const RESALTADO = 'prism';

const LENGUAJE_SEGURO = /^[\w+-]+$/;
const URL_SEGURA = /^(?:https?:|mailto:|[/#.?]|[^:]*$)/;

/** Whether a URL may go into `href` or `src`. `url` is already decoded (no entities). */
export function esUrlSegura(url: string): boolean {
  // Browsers ignore control characters and whitespace inside the scheme (`java\tscript:`).
  // eslint-disable-next-line no-control-regex
  const limpia = url.replace(/[\u0000- \u007f]/g, '').toLowerCase();
  return URL_SEGURA.test(limpia);
}

function comprobarUrl(url: string): void {
  if (!esUrlSegura(url)) throw new Error(`El Markdown no admite la URL «${url.slice(0, 60)}»`);
}

export const sanearMarkdown = defineMdastPlugin({
  name: 'solfeo-sanear-markdown',
  html(node) {
    throw new Error(`El Markdown no admite HTML crudo: ${node.value.trim().slice(0, 60)}`);
  },
  code(node) {
    if (node.lang != null && !LENGUAJE_SEGURO.test(node.lang)) {
      throw new Error(`Lenguaje de bloque de código no válido: «${node.lang.slice(0, 60)}»`);
    }
  },
  link: (node) => comprobarUrl(node.url),
  image: (node) => comprobarUrl(node.url),
  definition: (node) => comprobarUrl(node.url),
});

const ALINEACION = /^\s*text-align:\s*(left|center|right)\s*;?\s*$/;

/** Moves GFM table alignment from `style="text-align: x"` to an `align-x` class. */
export function alinearConClase(celda: Element): Element | undefined {
  const estilo = celda.properties['style'];
  if (typeof estilo !== 'string') return undefined;
  const resto = { ...celda.properties };
  delete resto['style'];
  const alineacion = ALINEACION.exec(estilo)?.[1];
  if (!alineacion) return { ...celda, properties: resto };
  const clases = Array.isArray(resto['className']) ? resto['className'] : [];
  return { ...celda, properties: { ...resto, className: [...clases, `align-${alineacion}`] } };
}

export const alinearTablas = defineHastPlugin({
  name: 'solfeo-alinear-tablas',
  element: {
    filter: ['th', 'td'],
    visit: (node: Element) => alinearConClase(node),
  },
});

export const PLUGINS_MARKDOWN = {
  mdastPlugins: [sanearMarkdown],
  hastPlugins: [codeFrame, alinearTablas],
};
