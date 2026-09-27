/**
 * Renders a Markdown string from our content (the model answer of a case) to HTML at build time,
 * with the same pipeline as lesson files (`markdown-opciones.ts`). Astro only applies its Markdown
 * config to Markdown files, not to strings inside YAML.
 *
 * The HTML ends up in a Preact island through `dangerouslySetInnerHTML`. It is safe because the
 * pipeline rejects raw HTML, unsafe fence languages and unsafe URLs, and escapes the text.
 */
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { PLUGINS_MARKDOWN, RESALTADO } from './markdown-opciones';

let procesador: ReturnType<typeof createSatteriMarkdownProcessor> | undefined;

function obtenerProcesador(): ReturnType<typeof createSatteriMarkdownProcessor> {
  procesador ??= createSatteriMarkdownProcessor({
    syntaxHighlight: RESALTADO,
    ...PLUGINS_MARKDOWN,
  }).catch((error: unknown) => {
    // Do not keep a failed start cached: the next call tries again.
    procesador = undefined;
    throw error;
  });
  return procesador;
}

/** HTML of a Markdown text. `origen` names the content in error messages. */
export async function renderizarMarkdown(markdown: string, origen: string): Promise<string> {
  try {
    const { code } = await (await obtenerProcesador()).render(markdown);
    return code;
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    throw new Error(`${origen}: ${motivo}`, { cause: error });
  }
}
