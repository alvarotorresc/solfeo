/**
 * Runs the content validator on the real content, the same check as `pnpm content:check`, so a
 * broken lesson also fails the test suite. The checks themselves are tested with fixtures in
 * `src/lib/content/validate`.
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../lib/content/validate/validate-content';
import { TIENDA_SQL } from '../test/tienda';

describe('src/content', () => {
  it('passes the content validator without errors', async () => {
    const informe = await validateContent({
      raiz: fileURLToPath(new URL('.', import.meta.url)),
      semilla: TIENDA_SQL,
    });
    expect(informe.errores).toEqual([]);
  });
});
