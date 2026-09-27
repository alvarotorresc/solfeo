/**
 * Minimal inline Markdown for content texts: `code`, **strong** and *emphasis* (or _emphasis_).
 * Returns plain pieces the UI turns into elements, so no HTML string is ever injected.
 * Code wins over emphasis, and markers inside code stay literal (`SELECT * FROM t`).
 * Nesting is not supported: the inside of each piece is plain text.
 */

export type TipoTrozo = 'texto' | 'codigo' | 'fuerte' | 'enfasis';

export interface Trozo {
  tipo: TipoTrozo;
  texto: string;
}

// Emphasis markers must hug the text (`* a *` is not emphasis), a `*` touching a parenthesis is
// SQL (`COUNT(*)`), and `_` must not sit inside a word, so `a * b`, `COUNT(*)` or names like
// `precio_unitario` outside backticks stay as they are.
const PATRON =
  /`([^`]+)`|(?<!\()\*\*(?![\s)])([^*]+?)(?<![\s(])\*\*(?!\))|(?<![(*])\*(?![\s)*])([^*]+?)(?<![\s(*])\*(?![)*])|(?<![\p{L}\p{N}_])_(?!\s)([^_]+?)(?<!\s)_(?![\p{L}\p{N}_])/gu;

export function trozosInline(texto: string): Trozo[] {
  const trozos: Trozo[] = [];
  let desde = 0;
  const anadirTexto = (hasta: number) => {
    if (hasta <= desde) return;
    const anterior = trozos[trozos.length - 1];
    const suelto = texto.slice(desde, hasta);
    if (anterior?.tipo === 'texto') anterior.texto += suelto;
    else trozos.push({ tipo: 'texto', texto: suelto });
  };
  for (const m of texto.matchAll(PATRON)) {
    anadirTexto(m.index);
    const [, codigo, fuerte, enfasis, enfasisGuion] = m;
    if (codigo !== undefined) trozos.push({ tipo: 'codigo', texto: codigo });
    else if (fuerte !== undefined) trozos.push({ tipo: 'fuerte', texto: fuerte });
    else trozos.push({ tipo: 'enfasis', texto: (enfasis ?? enfasisGuion) as string });
    desde = m.index + m[0].length;
  }
  anadirTexto(texto.length);
  return trozos;
}

/** The same text without Markdown markers, for screen reader announcements. */
export function textoPlano(texto: string): string {
  return trozosInline(texto)
    .map((trozo) => trozo.texto)
    .join('');
}
