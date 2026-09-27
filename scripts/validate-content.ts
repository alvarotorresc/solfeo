/**
 * `pnpm content:check`: validates `src/content` and prints the report. Exits with 1 only when
 * there are errors; warnings are printed but do not fail. An optional argument validates another
 * content root instead. The logic lives in `src/lib/content/validate`, tested with fixtures.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatReport } from '../src/lib/content/validate/report';
import { validateContent } from '../src/lib/content/validate/validate-content';

const informe = await validateContent({
  raiz: process.argv[2] ?? fileURLToPath(new URL('../src/content', import.meta.url)),
  semilla: readFileSync(new URL('../src/data/tienda.sql', import.meta.url), 'utf8'),
});

process.stdout.write(`${formatReport(informe)}\n`);
process.exitCode = informe.errores.length > 0 ? 1 : 0;
