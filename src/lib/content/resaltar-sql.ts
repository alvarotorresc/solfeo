/**
 * Highlights SQL with Prism at build time, the same highlighter Markdown uses, so quiz questions
 * look like lesson code blocks. Prism escapes the text; the output only carries token classes.
 */
import Prism from 'prismjs';
import 'prismjs/components/prism-sql.js';

export function resaltarSql(sql: string): string {
  const gramatica = Prism.languages['sql'];
  if (!gramatica) throw new Error('Prism no tiene cargada la gramática de SQL');
  return Prism.highlight(sql.trim(), gramatica, 'sql');
}
